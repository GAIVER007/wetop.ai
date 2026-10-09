import { describe, expect, it } from 'vitest';
import type { PlatformOrganization } from './api';
import { extensionFormDefaults, extensionLine, organizationStatusLine } from './platform';
import { extensionReminder } from './ai-seller';

// срок хранится моментом начала следующего дня по Алматы: «по 02.10.2026» — это 2 октября 19:00 UTC
const UNTIL = '2026-10-02T19:00:00.000Z';

const seller = (
  over: Partial<PlatformOrganization['aiSeller']> = {},
): PlatformOrganization['aiSeller'] => ({
  access: 'active',
  status: 'ACTIVE',
  activeUntil: null,
  daysLeft: null,
  note: null,
  updatedAt: null,
  ...over,
});

describe('«Платформа → Организации»: слова таблицы (ADR-083)', () => {
  it('расширение: действует, срок вышел, не подключали, выключен — с последним днём по Алматы', () => {
    expect(extensionLine(seller())).toEqual({
      label: 'действует',
      detail: 'оплачен, бессрочно',
      tone: 'ok',
    });
    expect(extensionLine(seller({ status: 'TRIAL', activeUntil: UNTIL, daysLeft: 7 }))).toEqual({
      label: 'действует',
      detail: 'пробный, по 02.10.2026',
      tone: 'ok',
    });
    expect(
      extensionLine(seller({ access: 'expired', activeUntil: UNTIL, daysLeft: 0 })).label,
    ).toBe('срок вышел');
    expect(extensionLine(seller({ access: 'off', status: null })).detail).toBe('не подключали');
    expect(extensionLine(seller({ access: 'off', status: 'OFF' })).detail).toBe('выключен');
  });

  it('состояние организации словами, без пробного периода', () => {
    expect(organizationStatusLine({ status: 'ACTIVE' }).label).toBe('работает');
    expect(organizationStatusLine({ status: 'READ_ONLY' }).label).toBe('только чтение');
    expect(organizationStatusLine({ status: 'SUSPENDED' }).label).toBe('приостановлена');
    expect(organizationStatusLine({ status: 'TRIAL' }).label).not.toMatch(/пробн/);
  });

  it('форма подставляет то, что стоит сейчас; не подключали — «оплачен» без срока', () => {
    expect(
      extensionFormDefaults(seller({ status: 'TRIAL', activeUntil: UNTIL, note: 'счёт 17' })),
    ).toEqual({
      status: 'TRIAL',
      activeUntil: '2026-10-02',
      note: 'счёт 17',
    });
    expect(extensionFormDefaults(seller({ access: 'off', status: null }))).toEqual({
      status: 'ACTIVE',
      activeUntil: '',
      note: '',
    });
  });
});

describe('напоминание владельцу о сроке расширения (Q-183)', () => {
  it('за 7 дней и в последний день; бессрочно, дальше недели и после срока — молчит', () => {
    expect(extensionReminder(seller({ activeUntil: UNTIL, daysLeft: 7 }))).toBe(
      'Расширение «ИИ-продавец» действует ещё 7 дней — по 02.10.2026. Потом раздел останется только для чтения. Продлевает администратор WETOP после оплаты.',
    );
    expect(extensionReminder(seller({ status: 'TRIAL', activeUntil: UNTIL, daysLeft: 1 }))).toBe(
      'Пробный доступ к ИИ-продавцу действует последний день — по 02.10.2026. Потом раздел останется только для чтения. Продлевает администратор WETOP после оплаты.',
    );
    expect(extensionReminder(seller({ activeUntil: UNTIL, daysLeft: 8 }))).toBeNull();
    expect(extensionReminder(seller())).toBeNull();
    expect(
      extensionReminder(seller({ access: 'expired', activeUntil: UNTIL, daysLeft: 0 })),
    ).toBeNull();
    expect(extensionReminder(null)).toBeNull();
  });
});
