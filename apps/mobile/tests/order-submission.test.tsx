import { OrderSubmission } from '../src/restaurant/order-submission';
import type { PendingOrder } from '../src/restaurant/pending-order';
const request = {
  creationRequestKey: 'attempt-one',
  tableId: null,
  guestCount: 1,
  items: [{ menuItemId: 'menu-one', qty: 1, modifierIds: [] }],
};
const attempt: PendingOrder = { context: 'context-one', request };
const order = {
  id: 'order-one',
  number: 1,
  status: 'NEW',
  table: null,
  waiter: null,
  guestCount: 1,
  totalMinor: '1000',
  paidMinor: '0',
  currency: 'KZT',
  updatedAt: '2026-10-25T00:00:00Z',
  delayed: false,
  items: [],
};
function fixture() {
  const store = {
    read: jest.fn().mockResolvedValue(null),
    prepare: jest.fn().mockResolvedValue(attempt),
    acknowledge: jest.fn().mockResolvedValue(undefined),
  };
  const send = jest.fn().mockResolvedValue(order);
  const current = jest.fn().mockReturnValue(true);
  const controller = new OrderSubmission(store, send, current);
  return { store, send, current, controller };
}
test('persists before sending and ignores double taps', async () => {
  const f = fixture();
  let saved!: (a: PendingOrder) => void;
  f.store.prepare.mockImplementation(
    () =>
      new Promise((resolve) => {
        saved = resolve;
      }),
  );
  const pending = f.controller.submit(request);
  await f.controller.submit(request);
  expect(f.send).not.toHaveBeenCalled();
  saved(attempt);
  await pending;
  expect(f.send).toHaveBeenCalledTimes(1);
  expect(f.store.acknowledge).toHaveBeenCalledWith('attempt-one');
  expect(f.controller.snapshot().kind).toBe('confirmed');
});
test('storage failure sends nothing', async () => {
  const f = fixture();
  f.store.prepare.mockRejectedValue(new Error('disk'));
  await f.controller.submit(request);
  expect(f.send).not.toHaveBeenCalled();
  expect(f.controller.snapshot().kind).toBe('storage-error');
});
test('timeout preserves the attempt and explicit retry reads its original payload', async () => {
  const f = fixture();
  f.send.mockRejectedValueOnce(new Error('lost reply'));
  await f.controller.submit(request);
  expect(f.controller.snapshot().kind).toBe('unknown');
  expect(f.store.acknowledge).not.toHaveBeenCalled();
  f.store.read.mockResolvedValue(attempt);
  await f.controller.retry();
  expect(f.send.mock.calls).toEqual([[request], [request]]);
  expect(f.controller.snapshot().kind).toBe('confirmed');
});
test('restoring a pending attempt never sends automatically', async () => {
  const f = fixture();
  f.store.read.mockResolvedValue(attempt);
  await f.controller.restore();
  expect(f.controller.snapshot().kind).toBe('pending');
  expect(f.send).not.toHaveBeenCalled();
});
test('late success after context change cannot acknowledge or expose the order', async () => {
  const f = fixture();
  f.send.mockImplementation(async () => {
    f.current.mockReturnValue(false);
    return order;
  });
  await f.controller.submit(request);
  expect(f.store.acknowledge).not.toHaveBeenCalled();
  expect(f.controller.snapshot().kind).toBe('context-changed');
  expect(JSON.stringify(f.controller.snapshot())).not.toContain('order-one');
});
test('malformed acknowledgement remains unknown', async () => {
  const f = fixture();
  f.send.mockResolvedValue({ id: 'order-one' });
  await f.controller.submit(request);
  expect(f.controller.snapshot().kind).toBe('unknown');
  expect(f.store.acknowledge).not.toHaveBeenCalled();
});
test('failed local acknowledgement keeps confirmed result and retries cleanup without network', async () => {
  const f = fixture();
  f.store.acknowledge.mockRejectedValueOnce(new Error('disk'));
  await f.controller.submit(request);
  expect(f.controller.snapshot().kind).toBe('confirmed-pending-cleanup');
  await f.controller.finish();
  expect(f.send).toHaveBeenCalledTimes(1);
  expect(f.controller.snapshot().kind).toBe('confirmed');
});

test('retry refuses an attempt replaced by another controller', async () => {
  const f = fixture();
  f.store.read.mockResolvedValue(attempt);
  await f.controller.restore();
  f.store.read.mockResolvedValue({
    ...attempt,
    request: { ...request, creationRequestKey: 'another-attempt' },
  });
  await f.controller.retry();
  expect(f.send).not.toHaveBeenCalled();
  expect(f.controller.snapshot().kind).toBe('storage-error');
});
