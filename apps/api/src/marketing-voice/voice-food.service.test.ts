import 'reflect-metadata';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { FoodReserveResult, FormSite, SiteFormsService, VoiceFoodCheck } from '../site-forms/site-forms.service';
import type { AgentProfile } from './voice-ingest.repository';
import type { VoiceQuoteRow, VoiceQuoteStore } from './voice-beauty.service';
import { VoiceFoodService } from './voice-food.service';

/** Бронь в ресторане по телефону: проверка свободного, котировка 30 минут, одна бронь на подтверждение. Данные вымышленные. */
const AGENT = '3f1c2a90-3b4d-4e5f-8a6b-7c8d9e0f1a2b';
const CALL = 'call-food-1';
const NOW = new Date('2026-11-09T05:00:00Z');

const profile = (patch: Partial<AgentProfile['booking']> = {}, vertical: AgentProfile['vertical'] = 'FOOD_SERVICE'): AgentProfile => ({
  agentId: AGENT, organizationId: 'org-a', vertical, objectName: 'Ресторан Тест', greetingTail: '', voiceName: 'Leda', handoffPhone: null,
  booking: { enabled: true, needsApproval: true, maxPerCall: 3, maxPerPhoneDay: 5, ...patch },
});
const FS = { organizationId: 'org-a', businessId: 'b', locationId: 'loc', locationName: 'Ресторан', vertical: 'FOOD_SERVICE', timezone: 'Asia/Almaty', currency: 'KZT', site: { id: 'voice-x', name: 'Голосовой агент', hosts: [] }, origin: 'VOICE' } as FormSite;
const OK: VoiceFoodCheck = { ok: true, startsAt: '2026-11-10T14:00:00.000Z', endsAt: '2026-11-10T16:00:00.000Z', period: 'Ужин' };
const RESERVED: FoodReserveResult = { reservationId: 'r-1', status: 'BOOKED', date: '2026-11-10', time: '19:00', startsAt: OK.startsAt, endsAt: OK.endsAt, partySize: 4 };

class FakeStore implements VoiceQuoteStore {
  rows = new Map<string, VoiceQuoteRow>();
  confirmed = 0;
  async countConfirmed() { return this.confirmed; }
  async countCreated() { return this.rows.size; }
  async create(row: Omit<VoiceQuoteRow, 'id' | 'state' | 'resultId'>) {
    const found = [...this.rows.values()].find((r) => r.agentId + r.callRef + r.requestHash === row.agentId + row.callRef + row.requestHash);
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

function make(opts: { profile?: AgentProfile | null; check?: VoiceFoodCheck; reserveFails?: Error; limit?: unknown } = {}) {
  const store = new FakeStore();
  const reserved: Array<{ req: unknown; key: string }> = [];
  const forms = {
    voiceSite: async () => FS,
    voiceFoodCheck: async () => opts.check ?? OK,
    voiceFoodReserve: async (_fs: unknown, req: unknown, key: string) => {
      reserved.push({ req, key });
      if (opts.reserveFails) throw opts.reserveFails;
      return RESERVED;
    },
  } as unknown as SiteFormsService;
  const repo = {
    profile: async () => (opts.profile === undefined ? profile() : opts.profile),
    resolveAgent: async () => ({ organizationId: 'org-a', businessId: 'b', locationId: 'loc' }),
  };
  return { service: new VoiceFoodService(repo as never, forms, store, opts.limit as never), store, reserved };
}

const base = { agent: AGENT, call: CALL };
const query = { ...base, date: '2026-11-10', time: '19:00', party: 4 };
const confirmBody = (quote: string) => ({ ...base, quote, consent: true, guest: { name: 'Тест', phone: '+77001112233', comment: 'у окна, детский стул' } });

describe('проверка свободного', () => {
  it('есть место: да, период и время', async () => {
    expect(await make().service.check(query, NOW)).toMatchObject({ ok: true, date: '2026-11-10', time: '19:00', partySize: 4, period: 'Ужин' });
  });
  it('мест нет или правила не пускают: ok=false с причиной, не ошибка', async () => {
    const out = await make({ check: { ok: false, reason: 'На это время свободных столов нет' } }).service.check(query, NOW);
    expect(out).toEqual({ ok: false, reason: 'На это время свободных столов нет', date: '2026-11-10', time: '19:00', partySize: 4 });
  });
  it('выключено, не ресторан, нет агента, мусор в дате и времени и числе гостей', async () => {
    await expect(make({ profile: profile({ enabled: false }) }).service.check(query, NOW)).rejects.toBeInstanceOf(ConflictException);
    await expect(make({ profile: profile({}, 'BEAUTY') }).service.check(query, NOW)).rejects.toBeInstanceOf(ConflictException);
    await expect(make({ profile: null }).service.check(query, NOW)).rejects.toBeInstanceOf(NotFoundException);
    for (const bad of [{ date: 'завтра' }, { time: '7 вечера' }, { party: 0 }, { party: 99 }, { party: 'много' }])
      await expect(make().service.check({ ...query, ...bad }, NOW)).rejects.toMatchObject({ status: 400 });
  });
});

describe('котировка', () => {
  it('место свободно: котировка на 30 минут', async () => {
    const h = make();
    const out = await h.service.quote(query, NOW);
    expect(out).toMatchObject({ quote: 'q-1', date: '2026-11-10', time: '19:00', partySize: 4, period: 'Ужин' });
    expect(h.store.rows.get('q-1')!.expiresAt.getTime() - NOW.getTime()).toBe(30 * 60_000);
  });
  it('места нет: 409, котировки нет', async () => {
    const h = make({ check: { ok: false, reason: 'На это время свободных столов нет' } });
    await expect(h.service.quote(query, NOW)).rejects.toBeInstanceOf(ConflictException);
    expect(h.store.rows.size).toBe(0);
  });
  it('повтор не плодит строки; лимиты за звонок', async () => {
    const h = make();
    await h.service.quote(query, NOW);
    await h.service.quote(query, NOW);
    expect(h.store.rows.size).toBe(1);
    const full = make();
    full.store.confirmed = 3;
    await expect(full.service.quote(query, NOW)).rejects.toBeInstanceOf(ConflictException);
    const many = make();
    for (let i = 0; i < 9; i++) many.store.rows.set(`x${i}`, { id: `x${i}` } as VoiceQuoteRow);
    await expect(many.service.quote(query, NOW)).rejects.toMatchObject({ status: 429 });
  });
});

describe('подтверждение', () => {
  it('бронь на имя и телефон гостя с комментарием, ключ = котировка, стол не назначается', async () => {
    const h = make();
    const q = await h.service.quote(query, NOW);
    const out = await h.service.confirm(confirmBody(q.quote), NOW);
    expect(h.reserved[0]!.key).toBe(`voice:${q.quote}`);
    expect(h.reserved[0]!.req).toMatchObject({ date: '2026-11-10', time: '19:00', partySize: 4, name: 'Тест', phone: '+77001112233', comment: 'у окна, детский стул' });
    expect(out).toMatchObject({ status: 'BOOKED', pendingApproval: true, partySize: 4 });
    expect(h.store.rows.get(q.quote)).toMatchObject({ state: 'CONFIRMED', resultId: 'r-1' });
  });
  it('без согласия, чужая котировка, истёкшая: отказ и брони нет', async () => {
    const h = make();
    const q = await h.service.quote(query, NOW);
    await expect(h.service.confirm({ ...confirmBody(q.quote), consent: false }, NOW)).rejects.toMatchObject({ status: 400 });
    await expect(h.service.confirm({ ...confirmBody(q.quote), call: 'other' }, NOW)).rejects.toBeInstanceOf(NotFoundException);
    await expect(h.service.confirm(confirmBody(q.quote), new Date(NOW.getTime() + 31 * 60_000))).rejects.toBeInstanceOf(ConflictException);
    expect(h.reserved).toHaveLength(0);
    expect(h.store.rows.get(q.quote)!.state).toBe('EXPIRED');
  });
  it('стол заняли между котировкой и подтверждением: котировка отклонена', async () => {
    const h = make({ reserveFails: new ConflictException('На это время свободных столов нет') });
    const q = await h.service.quote(query, NOW);
    await expect(h.service.confirm(confirmBody(q.quote), NOW)).rejects.toBeInstanceOf(ConflictException);
    expect(h.store.rows.get(q.quote)!.state).toBe('REJECTED');
  });
  it('повтор подтверждения отдаёт ту же бронь, имя и телефон обязательны', async () => {
    const h = make();
    const q = await h.service.quote(query, NOW);
    await h.service.confirm(confirmBody(q.quote), NOW);
    await h.service.confirm(confirmBody(q.quote), NOW);
    expect(new Set(h.reserved.map((r) => r.key)).size).toBe(1);
    const h2 = make();
    const q2 = await h2.service.quote(query, NOW);
    await expect(h2.service.confirm({ ...confirmBody(q2.quote), guest: { name: '', phone: '+77001112233' } }, NOW)).rejects.toMatchObject({ status: 400 });
    await expect(h2.service.confirm({ ...confirmBody(q2.quote), guest: { name: 'Тест', phone: '1' } }, NOW)).rejects.toMatchObject({ status: 400 });
  });
});

describe('суточный лимит на телефон', () => {
  const limit = (reached: boolean) => ({ hashOf: (p: string) => `h${p.replace(/\D/g, '')}`, reached: async () => reached });
  it('лимит достигнут: 409, брони нет', async () => {
    const h = make({ limit: limit(true) });
    const q = await h.service.quote(query, NOW);
    await expect(h.service.confirm(confirmBody(q.quote), NOW)).rejects.toBeInstanceOf(ConflictException);
    expect(h.reserved).toHaveLength(0);
  });
  it('не достигнут: хэш ставится при подтверждении; без лимита хэша нет', async () => {
    const h = make({ limit: limit(false) });
    const q = await h.service.quote(query, NOW);
    await h.service.confirm(confirmBody(q.quote), NOW);
    expect(h.store.hashes.get(q.quote)).toBe('h77001112233');
    const plain = make();
    const q2 = await plain.service.quote(query, NOW);
    await plain.service.confirm(confirmBody(q2.quote), NOW);
    expect(plain.store.hashes.get(q2.quote)).toBeNull();
  });
});

