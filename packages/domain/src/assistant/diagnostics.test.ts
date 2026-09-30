import { describe, expect, it } from 'vitest';
import { buildIntegrationHealth, buildReservationDiagnostics } from './diagnostics';

/**
 * S5: диагностика для WETOP Support (plans/ai-agents-s5-diagnostics-2026-09-29.md §2.3). Чистые функции: состояние
 * каналов и брони словами и кодами проблем, без личного и без денег — по построению, а не по фильтру.
 */
const now = new Date('2026-09-29T12:00:00Z');
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

const healthy = {
  keyConfigured: true,
  propertyMapped: true,
  categoriesTotal: 5,
  categoriesMapped: 5,
  ratePlansMapped: 3,
  lastEventAt: minutesAgo(7),
  outbox: { pending: 0, failed: 0, oldestPendingAt: null },
  webhook: { suspect: false, suspectReason: null, callbackReachable: true },
};

describe('состояние каналов (S5)', () => {
  it('всё сопоставлено, события идут, очередь пуста — READY без проблем', () => {
    expect(buildIntegrationHealth(healthy, now)).toEqual({
      state: 'READY',
      categories: { mapped: 5, total: 5 },
      ratePlansMapped: 3,
      lastEventAgeMinutes: 7,
      outbox: { pending: 0, failed: 0, oldestPendingMinutes: null },
      webhook: { suspect: false, reachable: true },
      problems: [],
    });
  });

  it('ключа нет — NO_KEY и одна проблема, остальные не проверяются', () => {
    const view = buildIntegrationHealth({ ...healthy, keyConfigured: false, categoriesMapped: 0 }, now);
    expect(view.state).toBe('NO_KEY');
    expect(view.problems).toEqual(['KEY_MISSING']);
  });

  it('объект не сопоставлен — NO_MAPPING', () => {
    const view = buildIntegrationHealth({ ...healthy, propertyMapped: false, categoriesMapped: 0 }, now);
    expect(view.state).toBe('NO_MAPPING');
    expect(view.problems).toEqual(['PROPERTY_NOT_MAPPED']);
  });

  it('часть категорий и тарифов без сопоставления, webhook под подозрением, очередь застряла — ATTENTION с кодами', () => {
    const view = buildIntegrationHealth(
      {
        ...healthy,
        categoriesMapped: 3,
        ratePlansMapped: 0,
        lastEventAt: minutesAgo(25 * 60),
        outbox: { pending: 4, failed: 2, oldestPendingAt: minutesAgo(45) },
        webhook: { suspect: true, suspectReason: 'нет событий', callbackReachable: false },
      },
      now,
    );
    expect(view.state).toBe('ATTENTION');
    expect(view.problems).toEqual([
      'CATEGORIES_UNMAPPED',
      'RATE_PLANS_UNMAPPED',
      'WEBHOOK_SUSPECT',
      'WEBHOOK_UNREACHABLE',
      'OUTBOX_FAILED',
      'OUTBOX_STUCK',
      'NO_EVENTS_24H',
    ]);
    expect(view.outbox.oldestPendingMinutes).toBe(45);
    expect(view.lastEventAgeMinutes).toBe(1500);
  });

  it('событий не было вовсе при сопоставленном объекте — NO_EVENTS_24H; очередь моложе 30 мин — не застряла', () => {
    const view = buildIntegrationHealth(
      { ...healthy, lastEventAt: null, outbox: { pending: 1, failed: 0, oldestPendingAt: minutesAgo(10) } },
      now,
    );
    expect(view.problems).toEqual(['NO_EVENTS_24H']);
    expect(view.lastEventAgeMinutes).toBeNull();
    expect(view.outbox.oldestPendingMinutes).toBe(10);
  });

  it('в ответе нет ни ключей, ни адресов: поля только из белого списка', () => {
    const view = buildIntegrationHealth(
      { ...healthy, ...({ apiKey: 'sk-secret', callbackUrl: 'https://x' } as object) },
      now,
    );
    expect(Object.keys(view).sort()).toEqual(
      ['categories', 'lastEventAgeMinutes', 'outbox', 'problems', 'ratePlansMapped', 'state', 'webhook'].sort(),
    );
    expect(JSON.stringify(view)).not.toContain('secret');
  });
});

const room = {
  id: 'i1',
  accommodationTypeCode: 'STD',
  accommodationTypeName: 'Стандарт',
  status: 'CONFIRMED',
  unitCode: 'R07' as string | null,
  unitHousekeepingStatus: 'INSPECTED' as 'DIRTY' | 'CLEAN' | 'INSPECTED' | null,
  guests: [{ id: 'g1', label: 'Тестовый Гость', isPrimary: true }],
  arrivalDate: '2026-10-02',
  departureDate: '2026-10-05',
};
const bed = {
  id: 'i2',
  accommodationTypeCode: 'BED',
  accommodationTypeName: 'Койка',
  status: 'CONFIRMED',
  unitCode: null as string | null,
  unitHousekeepingStatus: null as 'DIRTY' | 'CLEAN' | 'INSPECTED' | null,
  guests: [],
  arrivalDate: '2026-10-02',
  departureDate: '2026-10-05',
};
const card = {
  confirmationNumber: 'R-2026-0042',
  source: 'OTA',
  channel: 'Booking.com',
  status: 'CONFIRMED',
  arrivalDate: '2026-10-02',
  departureDate: '2026-10-05',
  adults: 2,
  children: 1,
  notes: 'позвонить гостю по +7 777 123 45 67',
  primaryGuest: { id: 'g1', label: 'Тестовый Гость', citizenship: 'KZ', phone: '+77771234567' },
  items: [room, bed],
};

describe('состояние брони (S5)', () => {
  it('бронь впереди с проживанием без ячейки — факты и UNASSIGNED_ITEMS; личного и денег нет', () => {
    const view = buildReservationDiagnostics(card, '2026-09-29');
    expect(view).toEqual({
      number: 'R-2026-0042',
      status: 'CONFIRMED',
      arrivalDate: '2026-10-02',
      departureDate: '2026-10-05',
      nights: 3,
      source: 'OTA',
      channel: 'Booking.com',
      guests: { adults: 2, children: 1 },
      items: [
        { category: 'Стандарт', status: 'CONFIRMED', unitAssigned: true, unitCode: 'R07', housekeeping: 'INSPECTED' },
        { category: 'Койка', status: 'CONFIRMED', unitAssigned: false, unitCode: null, housekeeping: null },
      ],
      problems: ['UNASSIGNED_ITEMS'],
    });
    const text = JSON.stringify(view);
    for (const secret of ['Тестовый', '777', 'позвонить', 'g1', 'i1', 'KZ']) expect(text).not.toContain(secret);
  });

  it('заезд прошёл, а бронь всё ещё CONFIRMED — ARRIVAL_PASSED_NOT_CHECKED_IN', () => {
    const view = buildReservationDiagnostics({ ...card, items: [room] }, '2026-10-03');
    expect(view.problems).toEqual(['ARRIVAL_PASSED_NOT_CHECKED_IN']);
  });

  it('выезд прошёл, а гость не выселен — DEPARTURE_PASSED_NOT_CHECKED_OUT', () => {
    const view = buildReservationDiagnostics(
      { ...card, status: 'CHECKED_IN', items: [{ ...room, status: 'CHECKED_IN' }] },
      '2026-10-06',
    );
    expect(view.problems).toEqual(['DEPARTURE_PASSED_NOT_CHECKED_OUT']);
  });

  it('заезд сегодня в непроверенную ячейку — UNIT_NOT_INSPECTED_BEFORE_ARRIVAL', () => {
    const view = buildReservationDiagnostics(
      { ...card, items: [{ ...room, unitHousekeepingStatus: 'DIRTY' }] },
      '2026-10-02',
    );
    expect(view.problems).toEqual(['UNIT_NOT_INSPECTED_BEFORE_ARRIVAL']);
  });

  it('отменённая и незаезд — только свой код, остальное не считается', () => {
    expect(buildReservationDiagnostics({ ...card, status: 'CANCELLED' }, '2026-10-09').problems).toEqual(['CANCELLED']);
    expect(buildReservationDiagnostics({ ...card, status: 'NO_SHOW' }, '2026-10-09').problems).toEqual(['NO_SHOW']);
  });

  it('выехавшая бронь — без проблем', () => {
    const view = buildReservationDiagnostics(
      { ...card, status: 'CHECKED_OUT', items: [{ ...room, status: 'CHECKED_OUT' }] },
      '2026-10-09',
    );
    expect(view.problems).toEqual([]);
  });
});
