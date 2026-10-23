import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { BookingIntentsService, IntentBooking, IntentQuote } from '../web-booking/booking-intents.service';
import type { Quote, WebBookingService } from '../web-booking/web-booking.service';
import type { AgentProfile, VoiceIngestRepository } from './voice-ingest.repository';
import { VoiceBookingService, type VoiceBookingStore } from './voice-booking.service';

/**
 * Бронь гостиницы по телефону (DATA_MODEL VOICE-BOOKING-OWNER-APPROVAL-20261023, план plans/voice-booking-2026-10-23.md).
 * Гости и телефоны вымышленные (ADR-010).
 */
const AGENT = '3f1c2a90-3b4d-4e5f-8a6b-7c8d9e0f1a2b';
const OTHER_AGENT = '4a2d3b01-4c5e-4f60-9b7c-8d9e0f1a2b3c';
const INTENT = '5b3e4c12-5d6f-4071-8c8d-9e0f1a2b3c4d';
const CALL = 'call-test-1';

const profile = (patch: Partial<AgentProfile['booking']> = {}, vertical: AgentProfile['vertical'] = 'HOSPITALITY'): AgentProfile => ({
  agentId: AGENT,
  organizationId: 'org-a',
  vertical,
  objectName: 'Гостиница Тест',
  greetingTail: '',
  voiceName: 'Leda',
  handoffPhone: null,
  booking: { enabled: true, needsApproval: true, maxPerCall: 3, maxPerPhoneDay: 5, ...patch },
});

const QUOTE: Quote = {
  site: 's',
  arrivalDate: '2026-11-10',
  departureDate: '2026-11-12',
  nights: 2,
  adults: 2,
  currency: 'KZT',
  checkInTime: '14:00',
  checkOutTime: '12:00',
  ratePlan: 'BAR',
  promo: null,
  categories: [
    { code: 'STD', name: 'Стандарт', capacity: 2, fits: true, available: 3, closed: false, totalMinor: '3000000', perNight: [] },
    { code: 'LUX', name: 'Люкс', capacity: 2, fits: true, available: 0, closed: false, totalMinor: null, perNight: [] },
  ],
};

interface Harness {
  service: VoiceBookingService;
  quotes: unknown[];
  confirms: unknown[];
  availability: unknown[];
}

function make(opts: { profile?: AgentProfile | null; confirmed?: number; created?: number; intent?: { agentId: string; conversationId: string; channel: string; state: string } | null } = {}): Harness {
  const h: Harness = { service: undefined as never, quotes: [], confirms: [], availability: [] };
  const repo = { profile: async () => (opts.profile === undefined ? profile() : opts.profile) } as unknown as VoiceIngestRepository;
  const web = {
    quoteForAgent: async (agent: string, raw: unknown) => {
      h.availability.push({ agent, raw });
      return QUOTE;
    },
  } as unknown as WebBookingService;
  const intents = {
    quote: async (raw: unknown, _now: Date, options: unknown): Promise<IntentQuote> => {
      h.quotes.push({ raw, options });
      return { intent: INTENT, expiresAt: 'x', categoryName: 'Стандарт', arrivalDate: '2026-11-10', departureDate: '2026-11-12', nights: 2, adults: 2, totalMinor: '3000000', currency: 'KZT', checkInTime: '14:00', checkOutTime: '12:00' };
    },
    confirm: async (raw: unknown, _now: Date, options: unknown): Promise<IntentBooking> => {
      h.confirms.push({ raw, options });
      return { confirmationNumber: 'WT-1', status: 'CONFIRMED', categoryName: 'Стандарт', arrivalDate: '2026-11-10', departureDate: '2026-11-12', nights: 2, adults: 2, totalMinor: '3000000', currency: 'KZT', replay: false };
    },
  } as unknown as BookingIntentsService;
  const store: VoiceBookingStore = {
    countConfirmed: async () => opts.confirmed ?? 0,
    countCreated: async () => opts.created ?? 0,
    intentOf: async () => (opts.intent === undefined ? { agentId: AGENT, conversationId: CALL, channel: 'voice', state: 'QUOTED' } : opts.intent),
  };
  h.service = new VoiceBookingService(repo, web, intents, store);
  return h;
}

const quoteBody = { agent: AGENT, call: CALL, category: 'STD', arrival: '2026-11-10', departure: '2026-11-12', adults: 2 };
const confirmBody = { agent: AGENT, call: CALL, intent: INTENT, consent: true, guest: { firstName: 'Тест', lastName: 'Тестов', phone: '+77001112233' } };

describe('выключатель и направление', () => {
  it('выключено: свободное, котировка и подтверждение отказывают словами', async () => {
    const h = make({ profile: profile({ enabled: false }) });
    await expect(h.service.availability({ agent: AGENT, call: CALL, arrival: '2026-11-10', departure: '2026-11-12', adults: 2 })).rejects.toBeInstanceOf(ConflictException);
    await expect(h.service.quote(quoteBody)).rejects.toBeInstanceOf(ConflictException);
    await expect(h.service.confirm(confirmBody)).rejects.toBeInstanceOf(ConflictException);
    expect(h.quotes).toHaveLength(0);
    expect(h.confirms).toHaveLength(0);
  });
  it('не гостиница: бронь по телефону не работает', async () => {
    const h = make({ profile: profile({}, 'BEAUTY') });
    await expect(h.service.quote(quoteBody)).rejects.toBeInstanceOf(ConflictException);
  });
  it('агента нет: 404', async () => {
    const h = make({ profile: null });
    await expect(h.service.quote(quoteBody)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('свободное', () => {
  it('отдаёт категории с признаком наличия и ценой платформы, без перечня номеров и идентификаторов', async () => {
    const h = make();
    const out = await h.service.availability({ agent: AGENT, call: CALL, arrival: '2026-11-10', departure: '2026-11-12', adults: 2, promo: 'SECRET' });
    expect(out.categories).toEqual([
      { code: 'STD', name: 'Стандарт', free: 'yes', totalMinor: '3000000' },
      { code: 'LUX', name: 'Люкс', free: 'no', totalMinor: null },
    ]);
    // промокод по телефону не принимается: скидку обещать нельзя
    expect(JSON.stringify(h.availability)).not.toContain('SECRET');
  });
});

describe('котировка', () => {
  it('идёт каналом голоса, звонок становится беседой, промокод вырезан', async () => {
    const h = make();
    await h.service.quote({ ...quoteBody, promo: 'SECRET' });
    const sent = h.quotes[0] as { raw: Record<string, unknown>; options: { channels: string[] } };
    expect(sent.raw).toMatchObject({ agent: AGENT, conversation: CALL, channel: 'voice', category: 'STD' });
    expect(sent.raw.promo).toBeUndefined();
    expect(sent.options.channels).toEqual(['voice']);
  });
  it('лимит подтверждённых за звонок: 409, котировка не создаётся', async () => {
    const h = make({ confirmed: 3 });
    await expect(h.service.quote(quoteBody)).rejects.toBeInstanceOf(ConflictException);
    expect(h.quotes).toHaveLength(0);
  });
  it('лимит котировок за звонок (втрое выше лимита броней) не даёт забить таблицу', async () => {
    const h = make({ created: 9 });
    await expect(h.service.quote(quoteBody)).rejects.toMatchObject({ status: 429 });
  });
  it('звонок без идентификатора или с мусором отклоняется', async () => {
    const h = make();
    await expect(h.service.quote({ ...quoteBody, call: '' })).rejects.toMatchObject({ status: 400 });
    await expect(h.service.quote({ ...quoteBody, call: 'a b;drop' })).rejects.toMatchObject({ status: 400 });
  });
});

describe('подтверждение', () => {
  it('передаёт гостя и ключ согласия, ставит пометку об ожидании подтверждения', async () => {
    const h = make();
    const out = await h.service.confirm(confirmBody);
    const sent = h.confirms[0] as { raw: { message: string; intent: string }; options: { channels: string[]; notes: string } };
    expect(sent.raw.intent).toBe(INTENT);
    expect(sent.raw.message).toBe(`voice:${CALL}:${INTENT}`);
    expect(sent.options.channels).toEqual(['voice']);
    expect(sent.options.notes).toMatch(/ожидает подтверждения/i);
    expect(out).toMatchObject({ confirmationNumber: 'WT-1', pendingApproval: true });
  });
  it('без ожидания подтверждения пометки нет', async () => {
    const h = make({ profile: profile({ needsApproval: false }) });
    const out = await h.service.confirm(confirmBody);
    expect((h.confirms[0] as { options: { notes?: string } }).options.notes).toBeUndefined();
    expect(out.pendingApproval).toBe(false);
  });
  it('без явного согласия не подтверждает', async () => {
    const h = make();
    await expect(h.service.confirm({ ...confirmBody, consent: false })).rejects.toMatchObject({ status: 400 });
    await expect(h.service.confirm({ ...confirmBody, consent: undefined })).rejects.toMatchObject({ status: 400 });
    expect(h.confirms).toHaveLength(0);
  });
  it('котировка чужого звонка, чужого агента или другого канала: 404', async () => {
    for (const intent of [
      { agentId: AGENT, conversationId: 'other-call', channel: 'voice', state: 'QUOTED' },
      { agentId: OTHER_AGENT, conversationId: CALL, channel: 'voice', state: 'QUOTED' },
      { agentId: AGENT, conversationId: CALL, channel: 'whatsapp', state: 'QUOTED' },
      null,
    ]) {
      const h = make({ intent });
      await expect(h.service.confirm(confirmBody)).rejects.toBeInstanceOf(NotFoundException);
      expect(h.confirms).toHaveLength(0);
    }
  });
  it('лимит подтверждённых за звонок: новая бронь отказана, повтор уже подтверждённой отдаётся', async () => {
    const full = make({ confirmed: 3 });
    await expect(full.service.confirm(confirmBody)).rejects.toBeInstanceOf(ConflictException);
    const replay = make({ confirmed: 3, intent: { agentId: AGENT, conversationId: CALL, channel: 'voice', state: 'CONFIRMED' } });
    await expect(replay.service.confirm(confirmBody)).resolves.toMatchObject({ confirmationNumber: 'WT-1' });
  });
});
