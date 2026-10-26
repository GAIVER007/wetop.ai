import { PaymentSubmission } from '../src/restaurant/payment-submission';
const attempt = {
  context: 'one',
  currency: 'KZT',
  request: { orderId: 'order', amount: 1000, method: 'CASH' as const, idempotencyKey: 'pay-one' },
};
const order = {
  id: 'order',
  number: 1,
  status: 'CLOSED',
  table: null,
  waiter: null,
  guestCount: 1,
  totalMinor: '1000',
  paidMinor: '1000',
  currency: 'KZT',
  updatedAt: '2026-10-25T00:00:00Z',
  delayed: false,
  items: [],
};
function fixture() {
  const store = {
    read: jest.fn().mockResolvedValue(attempt),
    prepare: jest.fn().mockResolvedValue(attempt),
    acknowledge: jest.fn(),
  };
  const send = jest.fn().mockResolvedValue(order);
  const current = jest.fn().mockReturnValue(true);
  return { store, send, current, controller: new PaymentSubmission(store, send, current) };
}
test('restores without payment, retries only saved amount/key and confirms server order', async () => {
  const f = fixture();
  await f.controller.restore();
  expect(f.send).not.toHaveBeenCalled();
  await f.controller.retry();
  expect(f.send).toHaveBeenCalledWith(attempt.request);
  expect(f.store.acknowledge).toHaveBeenCalledWith('pay-one');
  expect(f.controller.snapshot().kind).toBe('confirmed');
});
test('mismatching order or currency never releases payment attempt', async () => {
  for (const result of [
    { ...order, id: 'other' },
    { ...order, currency: 'USD' },
    { broken: true },
  ]) {
    const f = fixture();
    f.send.mockResolvedValue(result as typeof order);
    await f.controller.restore();
    await f.controller.retry();
    expect(f.controller.snapshot().kind).toBe('unknown');
    expect(f.store.acknowledge).not.toHaveBeenCalled();
  }
});
test('storage failure and repeated taps cannot send an unsaved payment', async () => {
  const f = fixture();
  f.store.prepare.mockRejectedValue(new Error('locked'));
  await f.controller.submit({ orderId: 'order', amount: 1000, method: 'CASH', currency: 'KZT' });
  expect(f.send).not.toHaveBeenCalled();
});
test('late payment response after account change stays pending', async () => {
  const f = fixture();
  f.send.mockImplementation(async () => {
    f.current.mockReturnValue(false);
    return order;
  });
  await f.controller.restore();
  await f.controller.retry();
  expect(f.controller.snapshot().kind).toBe('context-changed');
  expect(f.store.acknowledge).not.toHaveBeenCalled();
});
test('cleanup failure never repeats accepted payment', async () => {
  const f = fixture();
  f.store.acknowledge.mockRejectedValueOnce(new Error('disk'));
  await f.controller.restore();
  await f.controller.retry();
  expect(f.controller.snapshot().kind).toBe('confirmed-pending-cleanup');
  await f.controller.retry();
  await f.controller.finish();
  expect(f.send).toHaveBeenCalledTimes(1);
  expect(f.controller.snapshot().kind).toBe('confirmed');
});

test('lost payment reply retains original attempt and double taps send once', async () => {
  const f = fixture();
  let reject!: (reason: Error) => void;
  f.send.mockImplementation(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  await f.controller.restore();
  const pending = f.controller.retry();
  await f.controller.retry();
  expect(f.send).toHaveBeenCalledTimes(1);
  reject(new Error('lost'));
  await pending;
  expect(f.controller.snapshot().kind).toBe('unknown');
  expect(f.store.acknowledge).not.toHaveBeenCalled();
  f.send.mockResolvedValue(order);
  await f.controller.retry();
  expect(f.send).toHaveBeenNthCalledWith(2, attempt.request);
});
test('replaced saved payment is never sent by an old controller', async () => {
  const f = fixture();
  await f.controller.restore();
  f.store.read.mockResolvedValue({
    ...attempt,
    request: { ...attempt.request, amount: 2000, idempotencyKey: 'different' },
  });
  await f.controller.retry();
  expect(f.send).not.toHaveBeenCalled();
  expect(f.controller.snapshot().kind).toBe('storage-error');
});
