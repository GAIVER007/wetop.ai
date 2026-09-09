import { describe, expect, it } from 'vitest';
import { channex } from '@pms/integrations';
import { OutboxAriPublisher } from './ari-publisher';
import type { ChannelsRepository, ChannexGateway, OutboxRow } from './channels.repository';
import { MIN_INTERVAL_MS, OutboxWorker } from './outbox.worker';

type Row = OutboxRow & {
  status: string;
  taskId?: string | null;
  lastError?: string;
  nextAttemptAt: Date;
};
function makeRepo(rows: Row[] = []) {
  const repo = {
    async pendingOutbox(_p: string, kind: OutboxRow['kind'], now: Date) {
      return rows.filter(
        (r) => r.kind === kind && r.status === 'PENDING' && r.nextAttemptAt <= now,
      );
    },
    async markOutboxSent(ids: string[], taskId: string | null) {
      for (const r of rows) if (ids.includes(r.id)) Object.assign(r, { status: 'SENT', taskId });
    },
    async markOutboxRetry(ids: string[], error: string, next: Date, failed: boolean) {
      for (const r of rows)
        if (ids.includes(r.id))
          Object.assign(r, {
            attempts: r.attempts + 1,
            lastError: error,
            nextAttemptAt: next,
            status: failed ? 'FAILED' : 'PENDING',
          });
    },
    async enqueueOutbox(_p: string, kind: OutboxRow['kind'], payload: unknown[]) {
      rows.push({
        id: `o${rows.length + 1}`,
        kind,
        payload,
        attempts: 0,
        createdAt: new Date(),
        status: 'PENDING',
        nextAttemptAt: new Date(0),
      });
      return `o${rows.length}`;
    },
    async mappings() {
      return [
        {
          id: 'm0',
          localAccommodationTypeId: null,
          localAccommodationTypeCode: null,
          localRatePlanId: null,
          providerPropertyId: 'P',
          providerRoomTypeId: null,
          providerRatePlanId: null,
        },
        {
          id: 'm1',
          localAccommodationTypeId: 't1',
          localAccommodationTypeCode: 'exely-900001',
          localRatePlanId: 'p2',
          providerPropertyId: 'P',
          providerRoomTypeId: 'RT1',
          providerRatePlanId: 'RP1',
        },
        {
          id: 'm3',
          localAccommodationTypeId: 't3',
          localAccommodationTypeCode: 'exely-900003',
          localRatePlanId: 'p2',
          providerPropertyId: 'P',
          providerRoomTypeId: 'RT3',
          providerRatePlanId: 'RP3',
        },
      ];
    },
    async categoryUnits() {
      return [
        { code: 'exely-900001', active: 1, capacityAdults: 1 },
        { code: 'exely-900003', active: 36, capacityAdults: 1 },
      ];
    },
    async categoryBlocks() {
      return [];
    },
    async soldItems() {
      return [
        {
          accommodationTypeCode: 'exely-900003',
          arrivalDate: '2026-11-20',
          departureDate: '2026-11-22',
        },
        {
          accommodationTypeCode: 'exely-900003',
          arrivalDate: '2026-11-21',
          departureDate: '2026-11-22',
        },
      ];
    },
    async ratePlanIdsByCode() {
      return { 'exely-800002': 'p2', 'exely-800001': 'p1' };
    },
  } as unknown as ChannelsRepository;
  return { repo, rows };
}
function makeGateway(fail: () => Error | null = () => null) {
  const calls: Array<{ op: string; values: unknown[] }> = [];
  const gateway = {
    async updateAvailability(values: unknown[]) {
      const e = fail();
      if (e) throw e;
      calls.push({ op: 'availability', values });
      return { data: [{ id: `task-a${calls.length}`, type: 'task' }], meta: { warnings: [] } };
    },
    async updateRestrictions(values: unknown[]) {
      const e = fail();
      if (e) throw e;
      calls.push({ op: 'restrictions', values });
      return { data: [{ id: `task-r${calls.length}`, type: 'task' }], meta: { warnings: [] } };
    },
  } as unknown as ChannexGateway;
  return { gateway, calls };
}

describe('OutboxAriPublisher', () => {
  it('reservationChanged: availability = units − sold items (unassigned too), only for mapped categories, compressed ranges', async () => {
    const { repo, rows } = makeRepo();
    const pub = new OutboxAriPublisher(repo);
    await pub.reservationChanged({
      categoryCodes: ['exely-900003', 'exely-900001'],
      from: '2026-11-20',
      toExclusive: '2026-11-23',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.kind).toBe('AVAILABILITY');
    expect(rows[0]!.payload).toEqual([
      {
        property_id: 'P',
        room_type_id: 'RT3',
        date_from: '2026-11-20',
        date_to: '2026-11-20',
        availability: 35,
      },
      {
        property_id: 'P',
        room_type_id: 'RT3',
        date_from: '2026-11-21',
        date_to: '2026-11-21',
        availability: 34,
      },
      {
        property_id: 'P',
        room_type_id: 'RT3',
        date_from: '2026-11-22',
        date_to: '2026-11-22',
        availability: 36,
      },
      {
        property_id: 'P',
        room_type_id: 'RT1',
        date_from: '2026-11-20',
        date_to: '2026-11-22',
        availability: 1,
      },
    ]);
  });
  it('ratesChanged: maps (category, tariff) to the Channex rate plan, rate as minor-unit integer, unmapped tariff skipped', async () => {
    const { repo, rows } = makeRepo();
    const pub = new OutboxAriPublisher(repo);
    await pub.ratesChanged([
      {
        accommodationTypeCode: 'exely-900001',
        ratePlanCode: 'exely-800002',
        dateFrom: '2026-11-22',
        dateTo: '2026-11-22',
        priceMinor: 3_330_000n,
      },
      {
        accommodationTypeCode: 'exely-900003',
        ratePlanCode: 'exely-800002',
        dateFrom: '2026-11-01',
        dateTo: '2026-11-10',
        days: ['mo', 'tu'],
        minStay: 3,
        stopSell: true,
        closedToArrival: true,
      },
      {
        accommodationTypeCode: 'exely-900001',
        ratePlanCode: 'exely-800001',
        dateFrom: '2026-11-22',
        dateTo: '2026-11-22',
        priceMinor: 1n,
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.payload).toEqual([
      {
        property_id: 'P',
        rate_plan_id: 'RP1',
        date_from: '2026-11-22',
        date_to: '2026-11-22',
        rate: 3330000,
      },
      {
        property_id: 'P',
        rate_plan_id: 'RP3',
        date_from: '2026-11-01',
        date_to: '2026-11-10',
        days: ['mo', 'tu'],
        min_stay_arrival: 3,
        min_stay_through: 3,
        stop_sell: true,
        closed_to_arrival: true,
      },
    ]);
  });
});

describe('OutboxWorker', () => {
  const pending = (id: string, kind: OutboxRow['kind'], payload: unknown[]): Row => ({
    id,
    kind,
    payload,
    attempts: 0,
    createdAt: new Date(),
    status: 'PENDING',
    nextAttemptAt: new Date(0),
  });
  it('batches all pending rows of a kind into ONE Channex call (FIFO), records the task id', async () => {
    const { repo, rows } = makeRepo([
      pending('o1', 'RESTRICTIONS', [{ rate_plan_id: 'RP1', date: '2026-11-22', rate: 333 }]),
      pending('o2', 'RESTRICTIONS', [{ rate_plan_id: 'RP3', date: '2026-11-25', rate: 444 }]),
      pending('o3', 'AVAILABILITY', [{ room_type_id: 'RT1', date: '2026-11-21', availability: 7 }]),
    ]);
    const { gateway, calls } = makeGateway();
    const w = new OutboxWorker(gateway, repo);
    const res = await w.flush(true);
    expect(calls.map((c) => [c.op, c.values.length])).toEqual([
      ['availability', 1],
      ['restrictions', 2],
    ]);
    expect(res.sent).toEqual([
      { kind: 'AVAILABILITY', rows: 1, values: 1, taskId: 'task-a1' },
      { kind: 'RESTRICTIONS', rows: 2, values: 2, taskId: 'task-r2' },
    ]);
    expect(rows.map((r) => [r.id, r.status, r.taskId])).toEqual([
      ['o1', 'SENT', 'task-r2'],
      ['o2', 'SENT', 'task-r2'],
      ['o3', 'SENT', 'task-a1'],
    ]);
  });
  it('throttles to one call per kind per 6 s (10/min limit) unless forced', async () => {
    const { repo, rows } = makeRepo([pending('o1', 'AVAILABILITY', [{ a: 1 }])]);
    const { gateway, calls } = makeGateway();
    const w = new OutboxWorker(gateway, repo);
    let t = 1_000_000;
    w.now = () => t;
    await w.flush();
    rows.push(pending('o2', 'AVAILABILITY', [{ a: 2 }]));
    t += MIN_INTERVAL_MS - 1;
    const early = await w.flush();
    expect(early.skipped).toEqual([{ kind: 'AVAILABILITY', reason: 'throttled' }]);
    t += 2;
    await w.flush();
    expect(calls).toHaveLength(2);
  });
  it('on 429/5xx: exponential backoff, rows stay PENDING; FAILED after 6 attempts', async () => {
    const { repo, rows } = makeRepo([pending('o1', 'RESTRICTIONS', [{ r: 1 }])]);
    const { gateway } = makeGateway(
      () => new channex.ChannexApiError('Channex: HTTP 429', 429, '/restrictions'),
    );
    const w = new OutboxWorker(gateway, repo);
    let t = 0;
    w.now = () => t;
    const r1 = await w.flush(true);
    expect(r1.errors[0]).toMatchObject({
      kind: 'RESTRICTIONS',
      error: expect.stringContaining('429'),
    });
    expect(rows[0]).toMatchObject({ status: 'PENDING', attempts: 1 });
    expect(rows[0]!.nextAttemptAt.getTime()).toBe(120_000); // 60 с × 2^1
    for (let i = 0; i < 5; i += 1) {
      t = rows[0]!.nextAttemptAt.getTime();
      await w.flush(true);
    }
    expect(rows[0]).toMatchObject({ status: 'FAILED', attempts: 6 });
  });
});
