import { PendingPaymentStore } from '../src/restaurant/pending-payment';
const input = {
  orderId: '11111111-1111-4111-8111-111111111111',
  amount: 1234,
  method: 'CASH' as const,
  currency: 'KZT',
};
function fixture() {
  const data = new Map<string, string>();
  const storage = {
    get: jest.fn(async (key: string) => data.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      data.set(key, value);
    }),
    remove: jest.fn(async (key: string) => {
      data.delete(key);
    }),
  };
  const keys = jest.fn().mockReturnValue('attempt-1');
  return {
    data,
    storage,
    keys,
    store: new PendingPaymentStore(storage, 'payment', 'context', keys),
  };
}
test('writes and verifies original payment before returning, survives new instance', async () => {
  const f = fixture();
  const saved = await f.store.prepare(input);
  expect(saved.request).toEqual({
    orderId: input.orderId,
    amount: 1234,
    method: 'CASH',
    idempotencyKey: 'attempt-1',
  });
  expect(saved.currency).toBe('KZT');
  expect(await new PendingPaymentStore(f.storage, 'payment', 'context', f.keys).read()).toEqual(
    saved,
  );
  await expect(f.store.prepare({ ...input, amount: 2000 })).rejects.toThrow();
  expect(f.keys).toHaveBeenCalledTimes(1);
});
test('parallel instances cannot replace a pending payment', async () => {
  const f = fixture();
  const other = new PendingPaymentStore(f.storage, 'payment', 'context', () => 'another');
  const results = await Promise.allSettled([
    f.store.prepare(input),
    other.prepare({ ...input, amount: 2000 }),
  ]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
});
test('failed persistence blocks submission and malformed/context-mismatched data stays blocked', async () => {
  const f = fixture();
  f.storage.set.mockResolvedValueOnce(undefined);
  await expect(f.store.prepare(input)).rejects.toThrow();
  await f.store.prepare(input);
  await expect(
    new PendingPaymentStore(f.storage, 'payment', 'other', f.keys).read(),
  ).rejects.toThrow();
  f.data.set('payment', 'broken');
  await expect(f.store.prepare(input)).rejects.toThrow();
  expect(f.data.get('payment')).toBe('broken');
});
test('only matching acknowledgement frees the slot and removal is verified', async () => {
  const f = fixture();
  await f.store.prepare(input);
  await expect(f.store.acknowledge('wrong')).rejects.toThrow();
  f.storage.remove.mockResolvedValueOnce(undefined);
  await expect(f.store.acknowledge('attempt-1')).rejects.toThrow();
  expect(await f.store.read()).not.toBeNull();
  await f.store.acknowledge('attempt-1');
  expect(await f.store.read()).toBeNull();
});
