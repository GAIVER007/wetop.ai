import { describe, expect, it } from 'vitest';
import {
  newStaffLinkCode,
  normalizeStaffLinkCode,
  parseStaffBotUpdate,
  STAFF_LINK_CODE_ALPHABET,
  STAFF_NOTIFY_MAX_ATTEMPTS,
  staffLinkCodeHash,
  staffNotificationLink,
  staffNotificationRecipient,
  staffNotifyRetryDelayMs,
  type StaffRecipientInput,
} from './staff-telegram';

/**
 * Правила уведомлений сотрудникам в Telegram (STAFF-TG-20261020, план plans/staff-telegram-notifications-2026-10-20.md):
 * одноразовый код привязки, разбор команд бота, пауза повторов и кто получает сообщение о брони с сайта.
 */
describe('код привязки Telegram', () => {
  it('8 символов из алфавита без похожих знаков, равномерно из случайных байт', () => {
    const code = newStaffLinkCode((n) => Uint8Array.from({ length: n }, (_, i) => i * 37));
    expect(code).toMatch(/^[A-Z2-9]{8}$/);
    expect(STAFF_LINK_CODE_ALPHABET).toHaveLength(32);
    for (const ch of '01OI') expect(STAFF_LINK_CODE_ALPHABET).not.toContain(ch);
    expect([...code].every((ch) => STAFF_LINK_CODE_ALPHABET.includes(ch))).toBe(true);
  });

  it('ввод нормализуется: регистр и пробелы; чужие символы и длина отклоняются', () => {
    expect(normalizeStaffLinkCode(' ab2c-d3ef ')).toBeNull();
    expect(normalizeStaffLinkCode(' ab2cd3ef ')).toBe('AB2CD3EF');
    expect(normalizeStaffLinkCode('AB2CD3E')).toBeNull();
    expect(normalizeStaffLinkCode('AB2CD3E0')).toBeNull();
    expect(normalizeStaffLinkCode(null)).toBeNull();
  });

  it('в базу идёт SHA-256 hex, не сам код', () => {
    const hash = staffLinkCodeHash('AB2CD3EF');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('AB2CD3EF');
    expect(staffLinkCodeHash('AB2CD3EF')).toBe(hash);
  });
});

describe('команды бота', () => {
  const update = (text: string, chat: Record<string, unknown> = { id: 4242, type: 'private', username: 'synthetic' }) => ({
    update_id: 1,
    message: { message_id: 7, chat, text },
  });

  it('/start <код> из личного чата: привязка с номером чата и именем', () => {
    expect(parseStaffBotUpdate(update('/start ab2cd3ef'))).toEqual({
      kind: 'start',
      code: 'AB2CD3EF',
      chatId: '4242',
      username: 'synthetic',
    });
    expect(parseStaffBotUpdate(update('/start@wetop_bot AB2CD3EF'))).toMatchObject({ kind: 'start', code: 'AB2CD3EF' });
  });

  it('/start без кода или с кривым кодом: start без кода', () => {
    expect(parseStaffBotUpdate(update('/start'))).toMatchObject({ kind: 'start', code: null });
    expect(parseStaffBotUpdate(update('/start hello-world'))).toMatchObject({ kind: 'start', code: null });
  });

  it('/stop отключает; прочий текст и не личные чаты не обрабатываются', () => {
    expect(parseStaffBotUpdate(update('/stop'))).toEqual({ kind: 'stop', chatId: '4242' });
    expect(parseStaffBotUpdate(update('привет'))).toEqual({ kind: 'other', chatId: '4242' });
    expect(parseStaffBotUpdate(update('/start AB2CD3EF', { id: -100123, type: 'group' }))).toEqual({ kind: 'ignore' });
    expect(parseStaffBotUpdate({ update_id: 2, my_chat_member: {} })).toEqual({ kind: 'ignore' });
    expect(parseStaffBotUpdate(null)).toEqual({ kind: 'ignore' });
  });
});

describe('повторы отправки', () => {
  it('нарастающая пауза, шесть попыток укладываются примерно в час', () => {
    const delays = [1, 2, 3, 4, 5].map(staffNotifyRetryDelayMs);
    for (let i = 1; i < delays.length; i += 1) expect(delays[i]!).toBeGreaterThan(delays[i - 1]!);
    const total = delays.reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(40 * 60_000);
    expect(total).toBeLessThanOrEqual(75 * 60_000);
    expect(STAFF_NOTIFY_MAX_ATTEMPTS).toBe(6);
  });
});

describe('ссылка «Открыть в WETOP»', () => {
  const app = 'https://app.wetop.ai/';
  it('гостиница: карточка брони; салон и ресторан: день журнала; заявка: продажи', () => {
    expect(staffNotificationLink(app, { kind: 'SITE_BOOKING_HOTEL', confirmationNumber: 'WT-1' })).toBe(
      'https://app.wetop.ai/reservations/WT-1',
    );
    expect(staffNotificationLink(app, { kind: 'SITE_APPOINTMENT', date: '2026-10-24' })).toBe(
      'https://app.wetop.ai/appointments?date=2026-10-24',
    );
    expect(staffNotificationLink(app, { kind: 'SITE_TABLE', date: '2026-10-25' })).toBe(
      'https://app.wetop.ai/table-reservations?date=2026-10-25',
    );
    expect(staffNotificationLink(app, { kind: 'SITE_LEAD' })).toBe('https://app.wetop.ai/sales');
  });
});

describe('кто получает сообщение о брони с сайта', () => {
  const target = { businessId: 'b1', locationId: 'l1' };
  const base: StaffRecipientInput = {
    kind: 'SITE_BOOKING_HOTEL',
    vertical: 'HOSPITALITY',
    target,
    userActive: true,
    membership: { role: 'STAFF', status: 'ACTIVE' },
    scopes: [],
    beautyAssignments: [],
  };

  it('администратор без ограничений получает бронь гостиницы', () => {
    expect(staffNotificationRecipient(base)).toBe(true);
  });

  it('приостановленный, заблокированный, назначенный в другой филиал: нет', () => {
    expect(staffNotificationRecipient({ ...base, membership: { role: 'STAFF', status: 'SUSPENDED' } })).toBe(false);
    expect(staffNotificationRecipient({ ...base, userActive: false })).toBe(false);
    expect(
      staffNotificationRecipient({ ...base, scopes: [{ role: 'STAFF', businessId: 'b1', locationId: 'l2' }] }),
    ).toBe(false);
    expect(
      staffNotificationRecipient({ ...base, scopes: [{ role: 'MANAGER', businessId: 'b1', locationId: null }] }),
    ).toBe(true);
  });

  it('заявка без брони: право диалогов, сотруднику с ограничением по филиалам закрыта', () => {
    const lead = { ...base, kind: 'SITE_LEAD' as const };
    expect(staffNotificationRecipient(lead)).toBe(true);
    expect(
      staffNotificationRecipient({ ...lead, scopes: [{ role: 'STAFF', businessId: 'b1', locationId: 'l1' }] }),
    ).toBe(false);
  });

  it('салон с должностями: записи BUSINESS получают, OWN только свою, без права нет', () => {
    const appointment: StaffRecipientInput = { ...base, kind: 'SITE_APPOINTMENT', vertical: 'BEAUTY' };
    const assignment = (scope: 'OWN' | 'BUSINESS' | null) => ({
      businessId: 'b1',
      locationId: null,
      revokedAt: null,
      position: {
        archivedAt: null,
        permissions: scope ? [{ section: 'appointments' as const, action: 'view' as const, scope }] : [],
      },
    });
    expect(staffNotificationRecipient({ ...appointment, beautyAssignments: [assignment('BUSINESS')] })).toBe(true);
    expect(staffNotificationRecipient({ ...appointment, beautyAssignments: [assignment('OWN')] })).toBe(false);
    expect(
      staffNotificationRecipient({ ...appointment, beautyAssignments: [assignment('OWN')], ownEmployee: true }),
    ).toBe(true);
    expect(staffNotificationRecipient({ ...appointment, beautyAssignments: [assignment(null)] })).toBe(false);
    // владелец всегда получает
    expect(
      staffNotificationRecipient({
        ...appointment,
        membership: { role: 'OWNER', status: 'ACTIVE' },
        beautyAssignments: [assignment(null)],
      }),
    ).toBe(true);
  });
});
