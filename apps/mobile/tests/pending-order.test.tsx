import { PendingOrderStore } from '../src/restaurant/pending-order';
const payload = {
  tableId: null,
  guestCount: 1,
  items: [
    {
      menuItemId: '11111111-1111-4111-8111-111111111111',
      qty: 2,
      notes: 'Без сахара',
      modifierIds: [],
    },
  ],
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
  const ids = jest.fn().mockReturnValueOnce('attempt-one').mockReturnValue('attempt-two');
  const store = new PendingOrderStore(storage, 'scope-one', 'context-one', ids);
  return { data, storage, ids, store };
}
test('commits an immutable attempt before returning and restores the same key after restart', async () => {
  const f = fixture();
  const attempt = await f.store.prepare(payload);
  expect(attempt.request.creationRequestKey).toBe('attempt-one');
  const restored = new PendingOrderStore(f.storage, 'scope-one', 'context-one', f.ids);
  expect(await restored.read()).toEqual(attempt);
  await expect(restored.prepare({ ...payload, guestCount: 2 })).rejects.toThrow();
  expect(f.ids).toHaveBeenCalledTimes(1);
});
test('chunks Unicode below the native storage entry limit', async () => {
  const f = fixture();
  const attempt = await f.store.prepare({ ...payload, notes: '🍵'.repeat(1000) });
  expect(await f.store.read()).toEqual(attempt);
  for (const value of f.data.values())
    expect(new TextEncoder().encode(value).length).toBeLessThan(2048);
});
test('partial storage failure never publishes an attempt', async () => {
  const f = fixture();
  f.storage.set.mockRejectedValueOnce(new Error('storage unavailable'));
  await expect(f.store.prepare(payload)).rejects.toThrow();
  expect(await f.store.read()).toBeNull();
});
test('missing chunk blocks replacement, and a different context cannot read the attempt', async () => {
  const f = fixture();
  await f.store.prepare(payload);
  await expect(
    new PendingOrderStore(f.storage, 'scope-one', 'context-two', f.ids).read(),
  ).rejects.toThrow();
  f.data.delete('scope-one.attempt-one.0');
  await expect(f.store.prepare(payload)).rejects.toThrow();
  expect(f.ids).toHaveBeenCalledTimes(1);
});
test('only acknowledging the matching confirmed key releases the slot', async () => {
  const f = fixture();
  const first = await f.store.prepare(payload);
  await expect(f.store.acknowledge('another-key')).rejects.toThrow();
  expect(await f.store.read()).toEqual(first);
  await f.store.acknowledge(first.request.creationRequestKey);
  expect(await f.store.read()).toBeNull();
  expect((await f.store.prepare(payload)).request.creationRequestKey).toBe('attempt-two');
});
test('simultaneous prepare cannot replace the first attempt', async () => {
  const f = fixture();
  const results = await Promise.allSettled([f.store.prepare(payload), f.store.prepare(payload)]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(f.ids).toHaveBeenCalledTimes(1);
});
