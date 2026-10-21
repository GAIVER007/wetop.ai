import { randomUUID } from 'node:crypto';
import {
  DEFAULT_REMINDER_TEMPLATE,
  certificateExpiry,
  generateCertificateCode,
  normalizeCertificateCode,
  parseBonusProgram,
  parseCertificateSale,
  parseReminderSettings,
  renderReminder,
  whatsappLink,
} from '@pms/domain';

/**
 * Подставной API напоминаний, бонусов и сертификатов салона (решение 21.10.2026) для UI-спеков:
 * настройки, «Напомнить сегодня», карточка клиента с бонусами, «Финансы → Сертификаты».
 * Засев: `POST /__test/salon-loyalty { reminders: [...], customer: {...}, bonusEntries: [...] }`. Данные вымышленные.
 */
export interface SalonLoyaltyRequest {
  path: string;
  method: string | undefined;
  body: Record<string, unknown>;
  locationId: string | null;
  query: URLSearchParams;
}
export interface SalonLoyaltyResponse {
  status: number;
  body: unknown;
}

type Reminder = { id: string; customerName: string; customerPhone: string | null; startsAt: string; state: 'MANUAL' | 'SENT' | 'FAILED' };
type Entry = { id: string; kind: string; amountMinor: string; reason: string | null; createdAt: string };
type Cert = { id: string; code: string; initialMinor: string; balanceMinor: string; currency: string; expiresAt: string; status: string; createdAt: string; buyer: null };

const state = {
  reminderSettings: { revision: 0, enabled: true, hoursBefore: [24, 2], template: null as string | null, whatsappTemplateName: null as string | null },
  bonusProgram: { revision: 0, enabled: false, accrualPercent: 5, maxRedeemPercent: 30, expiresDays: null as number | null },
  reminders: [] as Reminder[],
  customer: null as null | { id: string; firstName: string; lastName: string | null; phone: string | null },
  entries: [] as Entry[],
  certificates: [] as Cert[],
};

export function resetSalonLoyaltyFixture(): void {
  state.reminderSettings = { revision: 0, enabled: true, hoursBefore: [24, 2], template: null, whatsappTemplateName: null };
  state.bonusProgram = { revision: 0, enabled: false, accrualPercent: 5, maxRedeemPercent: 30, expiresDays: null };
  state.reminders = [];
  state.customer = null;
  state.entries = [];
  state.certificates = [];
}

const text = (r: Reminder) =>
  renderReminder(state.reminderSettings.template ?? DEFAULT_REMINDER_TEMPLATE, {
    имя: r.customerName, услуга: 'Стрижка', дата: 'сегодня', время: r.startsAt.slice(11, 16), мастер: 'Дина',
    салон: 'Студия', адрес: 'ул. Абая, 10', телефон: '+7 700 000 00 00',
  });

export function salonLoyaltyFixture(req: SalonLoyaltyRequest): SalonLoyaltyResponse | null {
  const { path, method, body } = req;
  if (path === '/__test/salon-loyalty' && method === 'POST') {
    const reminders = Array.isArray(body['reminders']) ? (body['reminders'] as Array<Record<string, unknown>>) : [];
    state.reminders = reminders.map((r) => ({
      id: randomUUID(),
      customerName: String(r['customerName'] ?? 'Клиент'),
      customerPhone: r['customerPhone'] == null ? null : String(r['customerPhone']),
      startsAt: String(r['startsAt'] ?? new Date().toISOString()),
      state: 'MANUAL',
    }));
    const c = body['customer'] as Record<string, unknown> | undefined;
    if (c) state.customer = { id: String(c['id']), firstName: String(c['firstName']), lastName: null, phone: (c['phone'] as string) ?? null };
    const entries = Array.isArray(body['bonusEntries']) ? (body['bonusEntries'] as Array<Record<string, unknown>>) : [];
    state.entries = entries.map((e) => ({
      id: randomUUID(), kind: String(e['kind']), amountMinor: String(e['amountMinor']), reason: (e['reason'] as string) ?? null,
      createdAt: new Date().toISOString(),
    }));
    if (body['bonusEnabled'] === true) state.bonusProgram = { ...state.bonusProgram, enabled: true, revision: Math.max(1, state.bonusProgram.revision) };
    return { status: 200, body: { ok: true } };
  }
  if (!path.startsWith('/beauty/')) return null;
  if (path === '/beauty/location-hours' && method === 'GET')
    return { status: 200, body: { location: { id: req.locationId, name: 'Филиал', timezone: 'Asia/Almaty' }, configured: false, revision: 0, intervals: [], conflicts: [], conflictsTruncated: false } };
  if (path === '/beauty/reminder-settings') {
    if (method === 'PUT') {
      const parsed = parseReminderSettings(body);
      if (!parsed.ok) return { status: 400, body: { message: parsed.reason } };
      if (parsed.value.expectedRevision !== state.reminderSettings.revision)
        return { status: 409, body: { message: 'Настройки напоминаний изменены. Обновите страницу.' } };
      const rest: Partial<typeof parsed.value> = { ...parsed.value };
      delete rest.expectedRevision;
      state.reminderSettings = { ...state.reminderSettings, ...rest, revision: state.reminderSettings.revision + 1 };
    }
    return {
      status: 200,
      body: { locationId: req.locationId, configured: state.reminderSettings.revision > 0, ...state.reminderSettings, defaultTemplate: DEFAULT_REMINDER_TEMPLATE, whatsappConnected: false },
    };
  }
  if (path === '/beauty/bonus-program') {
    if (method === 'PUT') {
      const parsed = parseBonusProgram(body);
      if (!parsed.ok) return { status: 400, body: { message: parsed.reason } };
      if (parsed.value.expectedRevision !== state.bonusProgram.revision)
        return { status: 409, body: { message: 'Настройки бонусов изменены. Обновите страницу.' } };
      const rest: Partial<typeof parsed.value> = { ...parsed.value };
      delete rest.expectedRevision;
      state.bonusProgram = { ...state.bonusProgram, ...rest, revision: state.bonusProgram.revision + 1 };
    }
    return { status: 200, body: { businessId: 'fixture', configured: state.bonusProgram.revision > 0, ...state.bonusProgram } };
  }
  if (path === '/beauty/reminders' && method === 'GET')
    return {
      status: 200,
      body: {
        date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date()),
        timezone: 'Asia/Almaty',
        items: state.reminders.map((r) => ({
          id: r.id, kind: 'REMINDER', state: r.state, stateLabel: r.state === 'MANUAL' ? 'Вручную' : 'Отправлено',
          channel: 'MANUAL', dueAt: r.startsAt, sentAt: null, attempts: 0, lastError: null, appointmentId: randomUUID(),
          appointmentStartsAt: r.startsAt, customerName: r.customerName, customerPhone: r.customerPhone,
          text: r.state === 'MANUAL' ? text(r) : null, whatsappUrl: r.state === 'MANUAL' ? whatsappLink(r.customerPhone, text(r)) : null,
        })),
      },
    };
  const done = /^\/beauty\/reminders\/([^/]+)\/done$/.exec(path);
  if (done && method === 'POST') {
    const r = state.reminders.find((x) => x.id === done[1]);
    if (!r) return { status: 404, body: { message: 'Напоминание не найдено' } };
    r.state = 'SENT';
    return { status: 201, body: { id: r.id, state: 'SENT' } };
  }
  const bonuses = /^\/beauty\/customers\/([^/]+)\/bonuses$/.exec(path);
  if (bonuses && method === 'GET') {
    const balance = state.entries.reduce((sum, e) => sum + BigInt(e.amountMinor), 0n);
    return {
      status: 200,
      body: {
        customerId: bonuses[1], currency: 'KZT',
        program: { enabled: state.bonusProgram.enabled, accrualPercent: state.bonusProgram.accrualPercent, maxRedeemPercent: state.bonusProgram.maxRedeemPercent, expiresDays: state.bonusProgram.expiresDays },
        balanceMinor: balance.toString(),
        entries: state.entries.map((e) => ({ ...e, currency: 'KZT', expiresAt: null, appointmentId: null, createdByName: null })),
      },
    };
  }
  const detail = /^\/beauty\/customers\/([0-9a-f-]{36})$/.exec(path);
  if (detail && method === 'GET' && state.customer && state.customer.id === detail[1])
    return {
      status: 200,
      body: { customer: { ...state.customer, email: null, notes: null, status: 'ACTIVE', isVip: false, birthDate: null }, visits: [], historyTruncated: false },
    };
  if (path === '/beauty/gift-certificates' && method === 'GET')
    return { status: 200, body: { currency: 'KZT', items: [...state.certificates].reverse() } };
  if (path === '/beauty/gift-certificates' && method === 'POST') {
    const parsed = parseCertificateSale(body);
    if (!parsed.ok) return { status: 400, body: { message: parsed.reason } };
    const now = new Date();
    const cert: Cert = {
      id: randomUUID(), code: generateCertificateCode(), initialMinor: parsed.value.amountMinor.toString(),
      balanceMinor: parsed.value.amountMinor.toString(), currency: 'KZT',
      expiresAt: certificateExpiry(now, parsed.value.months).toISOString(), status: 'ACTIVE', createdAt: now.toISOString(), buyer: null,
    };
    state.certificates.push(cert);
    return { status: 201, body: cert };
  }
  if (path === '/beauty/gift-certificates/lookup' && method === 'GET') {
    const code = normalizeCertificateCode(req.query.get('code') ?? '');
    if (!code) return { status: 400, body: { message: 'Введите код сертификата: 8 знаков' } };
    const cert = state.certificates.find((c) => c.code === code);
    return cert ? { status: 200, body: cert } : { status: 404, body: { message: 'Сертификат не найден' } };
  }
  return null;
}
