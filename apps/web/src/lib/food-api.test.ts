import { expect, it, vi } from 'vitest';
const { get, send } = vi.hoisted(() => ({
  get: vi.fn(async () => ({ items: [], nextCursor: null })),
  send: vi.fn(async () => ({ id: 'r' })),
}));
vi.mock('./api', () => ({ getJsonPublic: get, sendJson: send }));
import { foodApi } from './food-api';
it('covers all 16 MV6 routes, stable key and concurrency tokens including DELETE body', async () => {
  const area = { name: 'Synthetic', sortOrder: 0, active: true };
  const period = {
    name: 'Synthetic',
    weekday: 1,
    timeFrom: '18:00',
    timeTo: '23:00',
    endsNextDay: false,
    defaultDurationMinutes: 120,
    active: true,
  };
  const token = { expectedStatus: 'BOOKED' as const, expectedUpdatedAt: '2026-10-12T10:00:00Z' };
  await foodApi.areas('cursor');
  await foodApi.tables();
  await foodApi.periods();
  await foodApi.customers();
  await foodApi.reservations('2026-10-12', 'cursor');
  await foodApi.createArea(area);
  await foodApi.updateArea('a', area);
  await foodApi.createTable({ ...area, areaId: 'a', capacity: 4 });
  await foodApi.updateTable('t', { capacity: 2 });
  await foodApi.createPeriod(period);
  await foodApi.updatePeriod('p', period);
  const body = {
    servicePeriodId: 'p',
    startsAt: '2026-10-12T19:00:00+05:00',
    partySize: 2,
    customerId: 'c',
    source: 'DESK' as const,
  };
  await foodApi.create(body, 'stable-key');
  await foodApi.update('r', token);
  await foodApi.status('r', { ...token, status: 'CONFIRMED' });
  await foodApi.assign('r', { ...token, tableId: 't' });
  await foodApi.unassign('r', token);
  expect(get).toHaveBeenCalledTimes(5);
  expect(send).toHaveBeenCalledTimes(11);
  expect(get).toHaveBeenCalledWith(
    '/food-service/reservations?limit=100&cursor=cursor&date=2026-10-12',
  );
  expect(send).toHaveBeenCalledWith('POST', '/food-service/reservations', body, {
    'Idempotency-Key': 'stable-key',
  });
  expect(send).toHaveBeenCalledWith('DELETE', '/food-service/reservations/r/table', token);
});
