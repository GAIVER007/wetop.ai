import 'reflect-metadata';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { BeautyBookResult, BeautySlotsResult, FormSite, SiteFormsService, VoiceBeautyCatalog } from '../site-forms/site-forms.service';
import type { AgentProfile } from './voice-ingest.repository';
import { VoiceBeautyService, type VoiceQuoteRow, type VoiceQuoteStore } from './voice-beauty.service';

/** Салон по телефону (DATA_MODEL VOICE-BOOKING): слот только из выдачи, котировка 30 минут, одна запись на подтверждение. Данные вымышленные. */
const AGENT = '3f1c2a90-3b4d-4e5f-8a6b-7c8d9e0f1a2b';
const SERVICE = '5b3e4c12-5d6f-4071-8c8d-9e0f1a2b3c4d';
const MASTER = '6c4f5d23-6e70-4182-9d9e-0f1a2b3c4d5e';
const OTHER_MASTER = '7d506e34-7f81-4293-8eaf-1a2b3c4d5e6f';
const CALL = 'call-salon-1';
const NOW = new Date('2026-11-09T05:00:00Z');
const SLOT = '2026-11-10T05:00:00.000Z';

const profile = (patch: Partial<AgentProfile['booking']> = {}): AgentProfile => ({
  agentId: AGENT, organizationId: 'org-a', vertical: 'BEAUTY', objectName: 'Салон Тест', greetingTail: '', voiceName: 'Leda', handoffPhone: null,
  booking: { enabled: true, needsApproval: true, maxPerCall: 3, maxPerPhoneDay: 5, ...patch },
});
const FS = { organizationId: 'org-a', businessId: 'b', locationId: 'loc', locationName: 'Салон', vertical: 'BEAUTY', timezone: 'Asia/Almaty', currency: 'KZT', site: { id: 'voice-x', name: 'Голосовой агент', hosts: [] }, origin: 'VOICE' } as FormSite;
const SLOTS: BeautySlotsResult = {
  date: '2026-11-10', timezone: 'Asia/Almaty',
  service: { id: SERVICE, name: 'Стрижка', durationMinutes: 60, priceMinor: '500000', currency: 'KZT' },
  employees: [{ id: MASTER, name: 'Алия' }, { id: OTHER_MASTER, name: 'Мария' }],
  slots: [{ startsAt: SLOT, endsAt: '2026-11-10T06:00:00.000Z', time: '10:00', employeeIds: [MASTER, OTHER_MASTER] }],
};
const CATALOG: VoiceBeautyCatalog = { timezone: 'Asia/Almaty', currency: 'KZT', services: [{ id: SERVICE, name: 'Стрижка', durationMinutes: 60, priceMinor: '500000', masters: [{ id: MASTER, name: 'Алия' }] }] };
const BOOKED: BeautyBookResult = { appointmentId: 'ap-1', status: 'BOOKED', startsAt: SLOT, endsAt: '2026-11-10T06:00:00.000Z', service: { id: SERVICE, name: 'Стрижка' }, employee: { id: MASTER, name: 'Алия' }, priceMinor: '500000', currency: 'KZT' };

class FakeStore implements VoiceQuoteStore {
  rows = new Map<string, VoiceQuoteRow>();
  confirmed = 0;
  async countConfirmed() { return this.confirmed; }
  async countCreated() { return this.rows.size; }
  async create(row: Omit<VoiceQuoteRow, 'id' | 'state' | 'resultId'>) {
    const key = row.agentId + row.callRef + row.requestHash;
    const found = [...this.rows.values()].find((r) => r.agentId + r.callRef + r.requestHash === key);
    if (found) return found;
    const made: VoiceQuoteRow = { ...row, id: `q-${this.rows.size + 1}`, state: 'QUOTED', resultId: null };
    this.rows.set(made.id, made);
    return made;
  }
  async find(id: string) { return this.rows.get(id) ?? null; }
  hashes = new Map<string, string | null>();
  async settle(id: string, state: VoiceQuoteRow['state'], resultId?: string, guestPhoneHash?: string | null) {
    const r = this.rows.get(id);
    if (!r || r.state !== 'QUOTED') return false;
    this.rows.set(id, { ...r, state, resultId: resultId ?? null });
    this.hashes.set(id, guestPhoneHash ?? null);
    return true;
  }
}

function make(opts: { profile?: AgentProfile | null; slots?: BeautySlotsResult; bookFails?: Error; limit?: unknown } = {}) {
  const store = new FakeStore();
  const booked: Array<{ req: unknown; key: string }> = [];
  const slotCalls: unknown[] = [];
  const forms = {
    voiceSite: async () => FS,
    voiceBeautyCatalog: async () => CATALOG,
    voiceBeautySlots: async (_fs: unknown, q: unknown) => { slotCalls.push(q); return opts.slots ?? SLOTS; },
    voiceBeautyBook: async (_fs: unknown, req: unknown, key: string) => {
      booked.push({ req, key });
      if (opts.bookFails) throw opts.bookFails;
      return BOOKED;
    },
  } as unknown as SiteFormsService;
  const repo = {
    profile: async () => (opts.profile === undefined ? profile() : opts.profile),
    resolveAgent: async () => ({ organizationId: 'org-a', businessId: 'b', locationId: 'loc' }),
  };
  const service = new VoiceBeautyService(repo as never, forms, store, opts.limit as never);
  return { service, store, booked, slotCalls };
}

const base = { agent: AGENT, call: CALL };
const quoteBody = { ...base, service: SERVICE, employee: null, startsAt: SLOT };
const confirmBody = (quote: string) => ({ ...base, quote, consent: true, guest: { name: 'Тест', phone: '+77001112233', comment: 'без мытья' } });

describe('справочник и окна', () => {
  it('справочник отдаёт услуги с мастерами этой услуги', async () => {
    const out = await make().service.catalog(base, NOW);
    expect(out.services[0]!.masters).toEqual([{ id: MASTER, name: 'Алия' }]);
  });
  it('окна по услуге, дате и необязательному мастеру', async () => {
    const h = make();
    const out = await h.service.slots({ ...base, service: SERVICE, date: '2026-11-10', employee: MASTER }, NOW);
    expect(h.slotCalls[0]).toEqual({ serviceId: SERVICE, employeeId: MASTER, date: '2026-11-10' });
    expect(out.slots[0]).toMatchObject({ time: '10:00', startsAt: SLOT });
  });
  it('выключено, не салон, нет агента: отказ', async () => {
    await expect(make({ profile: profile({ enabled: false }) }).service.catalog(base, NOW)).rejects.toBeInstanceOf(ConflictException);
    await expect(make({ profile: { ...profile(), vertical: 'FOOD_SERVICE' } }).service.catalog(base, NOW)).rejects.toBeInstanceOf(ConflictException);
    await expect(make({ profile: null }).service.catalog(base, NOW)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('котировка', () => {
  it('слот из выдачи: котировка на 30 минут с ценой платформы', async () => {
    const h = make();
    const out = await h.service.quote(quoteBody, NOW);
    expect(out).toMatchObject({ quote: 'q-1', service: 'Стрижка', time: '10:00', priceMinor: '500000', currency: 'KZT', master: 'любой свободный' });
    expect(new Date(h.store.rows.get('q-1')!.expiresAt).getTime() - NOW.getTime()).toBe(30 * 60_000);
  });
  it('мастер названного гостем: имя в условиях, слот должен быть у этого мастера', async () => {
    const out = await make().service.quote({ ...quoteBody, employee: MASTER }, NOW);
    expect(out.master).toBe('Алия');
    await expect(make({ slots: { ...SLOTS, slots: [{ ...SLOTS.slots[0]!, employeeIds: [OTHER_MASTER] }] } }).service.quote({ ...quoteBody, employee: MASTER }, NOW)).rejects.toBeInstanceOf(ConflictException);
  });
  it('времени нет в выдаче окон: котировки нет', async () => {
    const h = make();
    await expect(h.service.quote({ ...quoteBody, startsAt: '2026-11-10T07:00:00.000Z' }, NOW)).rejects.toBeInstanceOf(ConflictException);
    expect(h.store.rows.size).toBe(0);
  });
  it('повтор той же котировки звонка отдаёт ту же строку', async () => {
    const h = make();
    await h.service.quote(quoteBody, NOW);
    await h.service.quote(quoteBody, NOW);
    expect(h.store.rows.size).toBe(1);
  });
  it('лимит броней за звонок и котировок за звонок', async () => {
    const full = make();
    full.store.confirmed = 3;
    await expect(full.service.quote(quoteBody, NOW)).rejects.toBeInstanceOf(ConflictException);
    const many = make();
    for (let i = 0; i < 9; i++) many.store.rows.set(`x${i}`, { id: `x${i}` } as VoiceQuoteRow);
    await expect(many.service.quote(quoteBody, NOW)).rejects.toMatchObject({ status: 429 });
  });
  it('мусор в услуге, времени и мастере: 400', async () => {
    const h = make();
    for (const bad of [{ service: 'x' }, { startsAt: 'завтра' }, { employee: 'x' }, { call: '' }])
      await expect(h.service.quote({ ...quoteBody, ...bad }, NOW)).rejects.toMatchObject({ status: 400 });
  });
});

describe('подтверждение', () => {
  it('запись создаётся от имени звонка с данными гостя и комментарием, ключ = котировка', async () => {
    const h = make();
    const q = await h.service.quote(quoteBody, NOW);
    const out = await h.service.confirm(confirmBody(q.quote), NOW);
    expect(h.booked[0]!.key).toBe(`voice:${q.quote}`);
    expect(h.booked[0]!.req).toMatchObject({ serviceId: SERVICE, serviceIds: [SERVICE], employeeId: null, name: 'Тест', phone: '+77001112233', comment: 'без мытья' });
    expect(out).toMatchObject({ status: 'BOOKED', pendingApproval: true, master: 'Алия' });
    expect(h.store.rows.get(q.quote)).toMatchObject({ state: 'CONFIRMED', resultId: 'ap-1' });
  });
  it('без явного согласия, чужая котировка, другой звонок, истёкшая: отказ и записи нет', async () => {
    const h = make();
    const q = await h.service.quote(quoteBody, NOW);
    await expect(h.service.confirm({ ...confirmBody(q.quote), consent: false }, NOW)).rejects.toMatchObject({ status: 400 });
    await expect(h.service.confirm({ ...confirmBody(q.quote), call: 'other' }, NOW)).rejects.toBeInstanceOf(NotFoundException);
    await expect(h.service.confirm(confirmBody('q-404'), NOW)).rejects.toBeInstanceOf(NotFoundException);
    await expect(h.service.confirm(confirmBody(q.quote), new Date(NOW.getTime() + 31 * 60_000))).rejects.toBeInstanceOf(ConflictException);
    expect(h.booked).toHaveLength(0);
    expect(h.store.rows.get(q.quote)!.state).toBe('EXPIRED');
  });
  it('время занято в момент подтверждения: котировка отклонена, гостю нужны новые окна', async () => {
    const h = make({ bookFails: new ConflictException('Это время уже занято, выберите другое') });
    const q = await h.service.quote(quoteBody, NOW);
    await expect(h.service.confirm(confirmBody(q.quote), NOW)).rejects.toBeInstanceOf(ConflictException);
    expect(h.store.rows.get(q.quote)!.state).toBe('REJECTED');
  });
  it('повторное подтверждение той же котировки отдаёт ту же запись и не плодит вторую', async () => {
    const h = make();
    const q = await h.service.quote(quoteBody, NOW);
    await h.service.confirm(confirmBody(q.quote), NOW);
    const again = await h.service.confirm(confirmBody(q.quote), NOW);
    expect(again).toMatchObject({ master: 'Алия' });
    expect(new Set(h.booked.map((b) => b.key)).size).toBe(1);
  });
  it('нужны имя и телефон', async () => {
    const h = make();
    const q = await h.service.quote(quoteBody, NOW);
    await expect(h.service.confirm({ ...confirmBody(q.quote), guest: { name: '', phone: '+77001112233' } }, NOW)).rejects.toMatchObject({ status: 400 });
    await expect(h.service.confirm({ ...confirmBody(q.quote), guest: { name: 'Тест', phone: '12' } }, NOW)).rejects.toMatchObject({ status: 400 });
    expect(h.booked).toHaveLength(0);
  });
});

describe('суточный лимит на телефон', () => {
  const limit = (reached: boolean) => ({ hashOf: (p: string) => `h${p.replace(/\D/g, '')}`, reached: async () => reached });
  it('лимит достигнут: 409, записи нет, котировка остаётся действующей', async () => {
    const h = make({ limit: limit(true) });
    const q = await h.service.quote(quoteBody, NOW);
    await expect(h.service.confirm(confirmBody(q.quote), NOW)).rejects.toBeInstanceOf(ConflictException);
    expect(h.booked).toHaveLength(0);
    expect(h.store.rows.get(q.quote)!.state).toBe('QUOTED');
  });
  it('лимит не достигнут: хэш телефона ставится вместе с подтверждением, номера в хэше нет', async () => {
    const h = make({ limit: limit(false) });
    const q = await h.service.quote(quoteBody, NOW);
    await h.service.confirm(confirmBody(q.quote), NOW);
    expect(h.store.hashes.get(q.quote)).toBe('h77001112233');
  });
  it('без лимита (нет секрета): запись проходит, хэша нет', async () => {
    const h = make();
    const q = await h.service.quote(quoteBody, NOW);
    await h.service.confirm(confirmBody(q.quote), NOW);
    expect(h.store.hashes.get(q.quote)).toBeNull();
  });
});

