import { beforeEach, expect, it, vi } from 'vitest';
import { RestaurantService } from './restaurant.service';
import { parseOrderCreate } from '@pms/domain';
const actor = vi.hoisted(() => ({ id: 'actor-one', waiter: null as null | { id: string } }));
vi.mock('../auth/request-context', async (load) => ({
  ...(await load<object>()),
  currentUserId: () => actor.id,
}));
vi.mock('./scope', async (load) => ({
  ...(await load<object>()),
  waiterSelf: async () => actor.waiter,
}));
const input = {
  guestCount: 2,
  items: [{ menuItemId: '11111111-1111-4111-8111-111111111111', qty: 1 }],
  creationRequestKey: 'attempt-001',
};
beforeEach(() => {
  actor.id = 'actor-one';
  actor.waiter = null;
});
function fixture() {
  const rows: Record<string, unknown>[] = [];
  const tx = {
    restaurantOrder: {
      findFirst: vi.fn(
        async ({ where }: { where: Record<string, unknown> }) =>
          rows.find(
            (r) =>
              r.locationId === where.locationId &&
              r.creationRequestKey === where.creationRequestKey,
          ) ?? null,
      ),
      aggregate: vi.fn(async () => ({ _max: { number: rows.length } })),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          ...data,
          id: `order-${rows.length + 1}`,
          status: 'NEW',
          openedAt: new Date(),
          items: [],
          payments: [],
          refunds: [],
        };
        rows.push(row);
        return row;
      }),
    },
  };
  const service = new RestaurantService({} as never, null, {} as never);
  const internals = service as unknown as {
    write: (
      permission: string,
      fn: (db: unknown, scope: unknown) => Promise<unknown>,
    ) => Promise<unknown>;
    checkTableAndWaiter: () => Promise<void>;
    orderItemsData: () => Promise<unknown>;
    audit: () => Promise<void>;
  };
  vi.spyOn(internals, 'write').mockImplementation(async (_p, fn) =>
    fn(tx, { locationId: 'location-one', currency: 'KZT' }),
  );
  vi.spyOn(internals, 'checkTableAndWaiter').mockResolvedValue();
  const pricing = vi
    .spyOn(internals, 'orderItemsData')
    .mockResolvedValue({ data: [], total: 1000n });
  const audit = vi.spyOn(internals, 'audit').mockResolvedValue();
  return { service, tx, rows, pricing, audit };
}
it('replays a committed order after lost response without pricing or creation again', async () => {
  const f = fixture();
  const first = await f.service.createOrder(input);
  f.pricing.mockRejectedValue(new Error('menu no longer available'));
  expect((await f.service.createOrder(input)).id).toBe(first.id);
  expect(f.tx.restaurantOrder.create).toHaveBeenCalledTimes(1);
  expect(f.audit).toHaveBeenCalledTimes(1);
});
it('rejects changed payload and another actor using the same key', async () => {
  const f = fixture();
  await f.service.createOrder(input);
  await expect(f.service.createOrder({ ...input, guestCount: 3 })).rejects.toMatchObject({
    status: 409,
  });
  actor.id = 'actor-two';
  await expect(f.service.createOrder(input)).rejects.toMatchObject({ status: 409 });
  expect(f.rows).toHaveLength(1);
});
it('does not return a replay reassigned away from the current waiter', async () => {
  actor.waiter = { id: 'waiter-one' };
  const f = fixture();
  await f.service.createOrder(input);
  f.rows[0]!.waiterId = 'waiter-two';
  await expect(f.service.createOrder(input)).rejects.toMatchObject({ status: 403 });
});
it('preserves requests without a key and rejects malformed keys', async () => {
  const legacy = { guestCount: input.guestCount, items: input.items };
  const f = fixture();
  await f.service.createOrder(legacy);
  await f.service.createOrder(legacy);
  expect(f.rows).toHaveLength(2);
  for (const key of ['', null, 123, 'x'.repeat(101), 'with space'])
    expect(() => parseOrderCreate({ ...input, creationRequestKey: key })).toThrow();
  expect(parseOrderCreate(input)).toMatchObject({ creationRequestKey: input.creationRequestKey });
});
