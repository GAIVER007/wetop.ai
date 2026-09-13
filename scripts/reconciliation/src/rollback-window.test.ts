import { describe, expect, it } from 'vitest';
import {
  exelyActions,
  matchRevisions,
  parseChannexTime,
  type ChannexRevision,
  type PmsEvent,
  type PmsReservation,
} from './rollback-window';

/**
 * Сверка окна отката (CUTOVER.md ROLLBACK, шаг 6): что Channex отдал за окно, что из этого приняла PMS,
 * и что администратор должен повторить в Exely, если канал возвращается туда.
 */
const rev = (
  p: Partial<ChannexRevision> & Pick<ChannexRevision, 'revisionId' | 'status' | 'insertedAt'>,
): ChannexRevision => ({
  bookingId: 'b1',
  uniqueId: 'BDC-1',
  otaName: 'Booking.com',
  arrivalDate: '2026-12-02',
  departureDate: '2026-12-03',
  amount: '9000.00',
  ...p,
});
const ev = (
  id: string,
  status: PmsEvent['status'],
  via: PmsEvent['receivedVia'] = 'WEBHOOK',
): PmsEvent => ({
  externalEventId: id,
  status,
  receivedVia: via,
  receivedAt: new Date('2026-09-13T13:03:37Z'),
  processedAt: status === 'PROCESSED' ? new Date('2026-09-13T13:03:45Z') : null,
  lastError: status === 'FAILED' ? 'нет маппинга' : null,
});

describe('parseChannexTime', () => {
  it('время Channex без зоны читается как UTC', () => {
    expect(parseChannexTime('2026-09-13T13:03:35.340123').toISOString()).toBe(
      '2026-09-13T13:03:35.340Z',
    );
  });
  it('время с зоной не сдвигается', () => {
    expect(parseChannexTime('2026-09-13T13:03:35Z').toISOString()).toBe('2026-09-13T13:03:35.000Z');
  });
});

describe('matchRevisions — ни одна бронь не потеряна', () => {
  it('каждая ревизия Channex находит событие PMS; нет события — «потеряна», FAILED — «не разобрана»', () => {
    const revisions = [
      rev({ revisionId: 'r1', status: 'new', insertedAt: new Date('2026-09-13T13:03:35Z') }),
      rev({ revisionId: 'r2', status: 'modified', insertedAt: new Date('2026-09-13T13:03:56Z') }),
      rev({ revisionId: 'r3', status: 'cancelled', insertedAt: new Date('2026-09-13T13:04:10Z') }),
    ];
    const m = matchRevisions(revisions, [ev('r1', 'PROCESSED'), ev('r3', 'FAILED', 'PULL')]);
    expect(m.rows.map((r) => [r.revision.revisionId, r.outcome])).toEqual([
      ['r1', 'processed'],
      ['r2', 'missing'],
      ['r3', 'failed'],
    ]);
    expect(m.summary).toEqual({
      revisions: 3,
      processed: 1,
      pending: 0,
      failed: 1,
      missing: 1,
      byWebhook: 1,
      byPull: 0,
    });
  });
  it('событие получено, но ещё не обработано — «в работе», а не потеряно', () => {
    const m = matchRevisions(
      [rev({ revisionId: 'r1', status: 'new', insertedAt: new Date('2026-09-13T13:03:35Z') })],
      [ev('r1', 'RECEIVED')],
    );
    expect(m.rows[0]!.outcome).toBe('pending');
    expect(m.summary.missing).toBe(0);
  });
});

describe('exelyActions — что повторить в Exely при откате', () => {
  const t = (s: string) => new Date(`2026-09-13T${s}Z`);
  const pms = (p: Partial<PmsReservation> = {}): PmsReservation => ({
    confirmationNumber: 'BDC-1',
    externalId: 'BDC-1',
    status: 'CONFIRMED',
    arrivalDate: '2026-12-02',
    departureDate: '2026-12-03',
    totalMinor: 900000n,
    ...p,
  });

  it('создана в окне и жива — создать в Exely', () => {
    const [a] = exelyActions(
      [rev({ revisionId: 'r1', status: 'new', insertedAt: t('13:00:00') })],
      [pms()],
    );
    expect(a!.action).toBe('create');
  });
  it('создана и отменена в окне — в Exely ничего не делать', () => {
    const [a] = exelyActions(
      [
        rev({ revisionId: 'r1', status: 'new', insertedAt: t('13:00:00') }),
        rev({ revisionId: 'r3', status: 'cancelled', insertedAt: t('13:05:00') }),
      ],
      [pms({ status: 'CANCELLED' })],
    );
    expect(a!.action).toBe('none');
  });
  it('бронь была до окна, в окне изменена — изменить в Exely; даты берутся из последней ревизии', () => {
    const [a] = exelyActions(
      [
        rev({
          revisionId: 'r2',
          status: 'modified',
          insertedAt: t('13:00:00'),
          arrivalDate: '2026-12-03',
          departureDate: '2026-12-04',
        }),
        rev({
          revisionId: 'r4',
          status: 'modified',
          insertedAt: t('13:10:00'),
          arrivalDate: '2026-12-05',
          departureDate: '2026-12-06',
        }),
      ],
      [pms({ arrivalDate: '2026-12-05', departureDate: '2026-12-06' })],
    );
    expect(a!.action).toBe('modify');
    expect([a!.arrivalDate, a!.departureDate]).toEqual(['2026-12-05', '2026-12-06']);
  });
  it('бронь была до окна, в окне отменена — отменить в Exely', () => {
    const [a] = exelyActions(
      [rev({ revisionId: 'r3', status: 'cancelled', insertedAt: t('13:00:00') })],
      [pms({ status: 'CANCELLED' })],
    );
    expect(a!.action).toBe('cancel');
  });
  it('новая ревизия связана с перенесённой из Exely бронью (ADR-024) — не создавать второй раз, сверить', () => {
    const [a] = exelyActions(
      [rev({ revisionId: 'r1', status: 'new', insertedAt: t('13:00:00') })],
      [pms({ confirmationNumber: '20260912-513903-1263604791' })],
    );
    expect(a!.action).toBe('verify');
    expect(a!.pmsNumber).toBe('20260912-513903-1263604791');
  });
  it('брони в PMS нет вовсе — к человеку, это потеря', () => {
    const [a] = exelyActions(
      [rev({ revisionId: 'r1', status: 'new', insertedAt: t('13:00:00') })],
      [],
    );
    expect(a!.action).toBe('lost');
  });
});
