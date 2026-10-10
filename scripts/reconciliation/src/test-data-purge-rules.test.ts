import { describe, expect, it } from 'vitest';
import { E2E_NOTE } from './e2e-cleanup-rules';
import {
  PURGE_MIN_AGE_MINUTES,
  decodeTyped,
  encodeTyped,
  guestsToDelete,
  paymentsToDelete,
  planPurge,
  testDataKind,
  type PurgeReservation,
} from './test-data-purge-rules';

/**
 * Удаление демо-данных из рабочей базы (план plans/plan-2026-09-13-live-db-clean.md, шаг A). До переключения каналов
 * в базе рядом лежат настоящие брони Exely и брони автотестов, проверок стойки и тестового Channex staging.
 * Удалять можно только второе, и только то, что точно не держит места, деньги настоящих счетов и не участвует в идущем тесте.
 */
const now = new Date('2026-09-13T20:00:00Z');
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);
const res = (over: Partial<PurgeReservation> = {}): PurgeReservation => ({
  id: 'r1',
  confirmationNumber: '20260910-ABC123',
  source: 'PHONE',
  notes: null,
  createdAt: minutesAgo(600),
  items: [{ id: 'i1', status: 'CANCELLED', exelyRoomStayId: null, allocations: 0 }],
  ...over,
});
const safe = { propertyLive: false, pendingChannexEvents: 0 };

describe('testDataKind: что считается тестовыми данными', () => {
  it('бронь из Exely — никогда, даже с меткой автотеста', () => {
    const exely = res({
      confirmationNumber: '20260901-513903-1262444623',
      source: 'DESK',
      notes: E2E_NOTE,
      items: [{ id: 'i1', status: 'CANCELLED', exelyRoomStayId: '9007199262225274', allocations: 0 }],
    });
    expect(testDataKind(exely)).toBeNull();
  });
  it('витринная бронь Channex -SHOW- остаётся до показа сертификации', () => {
    expect(testDataKind(res({ confirmationNumber: 'BDC-SHOW-22C80', source: 'OTA' }))).toBeNull();
  });
  it('метка автотеста, номер PMS, бронь тестового канала', () => {
    expect(testDataKind(res({ confirmationNumber: 'OFL-E2E-MTU18XN3', source: 'OTA', notes: `${E2E_NOTE}: x` }))).toBe('e2e');
    expect(testDataKind(res())).toBe('pms-number');
    expect(testDataKind(res({ confirmationNumber: 'BDC-WETOP-MU07E0SK', source: 'OTA' }))).toBe('channel-test');
  });
  it('номер в формате Exely без ссылки на проживание Exely — не угадываем, не удаляем', () => {
    expect(testDataKind(res({ confirmationNumber: '20260901-513903-1262444623', source: 'OTA' }))).toBeNull();
  });
});

describe('planPurge: что удаляется и что останавливает удаление', () => {
  it('отменённые и незаезды старше порога — кандидаты; свежие пропускаются', () => {
    const plan = planPurge(
      [
        res({ id: 'old', confirmationNumber: '20260910-OLD001' }),
        res({ id: 'noshow', confirmationNumber: '20260910-NOS001', items: [{ id: 'n', status: 'NO_SHOW', exelyRoomStayId: null, allocations: 0 }] }),
        res({ id: 'fresh', confirmationNumber: '20260913-NEW001', createdAt: minutesAgo(PURGE_MIN_AGE_MINUTES - 1) }),
      ],
      now,
      safe,
    );
    expect(plan.candidates.map((r) => r.id)).toEqual(['old', 'noshow']);
    expect(plan.skippedFresh).toEqual(['20260913-NEW001']);
    expect(plan.blockers).toEqual([]);
  });
  it('активное проживание или назначенная ячейка у кандидата — стоп, а не тихий пропуск', () => {
    const plan = planPurge(
      [
        res({ confirmationNumber: '20260910-ACT001', items: [{ id: 'a', status: 'CONFIRMED', exelyRoomStayId: null, allocations: 0 }] }),
        res({ confirmationNumber: '20260910-ALC001', items: [{ id: 'b', status: 'CANCELLED', exelyRoomStayId: null, allocations: 1 }] }),
      ],
      now,
      safe,
    );
    expect(plan.blockers).toHaveLength(2);
    expect(plan.blockers.join(' ')).toMatch(/20260910-ACT001.*активн/);
    expect(plan.blockers.join(' ')).toMatch(/20260910-ALC001.*ячейк/);
  });
  it('объект объявлен живым или есть необработанные ревизии Channex — стоп', () => {
    expect(planPurge([res()], now, { propertyLive: true, pendingChannexEvents: 0 }).blockers.join(' ')).toMatch(/GUARD_PROPERTY_LIVE/);
    expect(planPurge([res()], now, { propertyLive: false, pendingChannexEvents: 2 }).blockers.join(' ')).toMatch(/Channex/);
  });
  it('не из Exely, но без признаков теста — в отчёт, не в удаление', () => {
    const plan = planPurge([res({ confirmationNumber: 'MANUAL-1', source: 'DESK' })], now, safe);
    expect(plan.candidates).toEqual([]);
    expect(plan.unclassified).toEqual(['MANUAL-1']);
  });
});

describe('paymentsToDelete: деньги настоящих счетов не задеваются', () => {
  it('платёж удаляется, только если все его распределения и возвраты — в удаляемых счетах', () => {
    const r = paymentsToDelete({
      folioIds: new Set(['f1', 'f2']),
      payments: [
        { id: 'p1', allocationFolioIds: ['f1'], refundFolioIds: [] },
        { id: 'p2', allocationFolioIds: ['f1', 'real'], refundFolioIds: [] },
        { id: 'p3', allocationFolioIds: ['f2'], refundFolioIds: ['real'] },
      ],
    });
    expect(r.paymentIds).toEqual(['p1']);
    expect(r.blockers).toHaveLength(2);
  });
});

describe('guestsToDelete: гость удаляется, только если он весь в удаляемых бронях', () => {
  it('гость из Exely и гость настоящей брони остаются', () => {
    const ids = guestsToDelete({
      reservationIds: new Set(['r1', 'r2']),
      guests: [
        { id: 'g1', exelyPersonId: null, reservationIds: ['r1'] },
        { id: 'g2', exelyPersonId: null, reservationIds: ['r1', 'real'] },
        { id: 'g3', exelyPersonId: '123', reservationIds: ['r2'] },
      ],
    });
    expect(ids).toEqual(['g1']);
  });
});

describe('encodeTyped / decodeTyped: копия переживает BigInt и даты', () => {
  it('туда и обратно без потерь', () => {
    const row = { amount: 1566000n, paidAt: new Date('2026-09-02T11:04:00Z'), note: null, meta: { a: 1 } };
    const text = JSON.stringify(encodeTyped(row));
    expect(text).toContain('"$bigint":"1566000"');
    expect(decodeTyped(JSON.parse(text))).toEqual(row);
  });
});
