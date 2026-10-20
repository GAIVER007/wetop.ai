import { describe, expect, it, vi } from 'vitest';
import { createRetailRecovery, retailScope, validateRetailDraft, type RetailIntent } from './retail-recovery';

const key = '00000000-0000-4000-8000-000000000001';
const nextKey = '00000000-0000-4000-8000-000000000002';
const payload = { productId: key, quantityUnits: '2', method: 'CASH' };
const parts = ['org', 'business', 'location', 'user', 'property', 'KZT', '2099-01-01'];
const slot = retailScope(parts);
function fixture() {
  const entries = new Map<string, string>();
  const storage = {
    getItem: (k: string) => entries.get(k) ?? null,
    setItem: (k: string, v: string) => { entries.set(k, v); },
    key: (i: number) => [...entries.keys()][i] ?? null,
    get length() { return entries.size; },
  };
  const original: RetailIntent = { v: 1, key, payload, createdAt: 10, status: 'pending' };
  const legacy = `bar:retail:v1:${JSON.stringify(parts)}`;
  const uuid = vi.fn(() => nextKey);
  const make = (expiry = 1000) => createRetailRecovery(storage, slot, () => 100, uuid, expiry);
  return { entries, storage, original, legacy, uuid, make };
}

describe('real retail recovery controller, synthetic session storage only', () => {
  it('keeps owner scope stable after reauthentication but separates locations', () => {
    expect(retailScope([...parts.slice(0, 6), '2100-01-01'])).toBe(slot);
    expect(retailScope(parts.map((p, i) => i === 2 ? 'other' : p))).not.toBe(slot);
    expect(() => retailScope(parts.slice(1))).toThrow();
  });
  it('restores legacy without dispatch and explicitly retries exact key and payload', async () => {
    const f = fixture(); f.entries.set(f.legacy, JSON.stringify(f.original));
    const controller = f.make(), send = vi.fn(async () => {});
    expect(controller.read()?.status).toBe('retry');
    expect(send).not.toHaveBeenCalled();
    expect((await controller.submit(payload, send)).status).toBe('confirmed');
    expect(send).toHaveBeenCalledExactlyOnceWith(key, payload);
    expect(f.uuid).not.toHaveBeenCalled();
    controller.newIntent();
    expect(f.entries.has(f.legacy)).toBe(true);
    expect(JSON.parse(f.entries.get(`${slot}:resolved:${key}`)!)).toMatchObject({ status: 'confirmed', key, payload, createdAt: 10 });
    const reload = f.make(); expect(reload.read()).toBeNull();
    await reload.submit(payload, send);
    expect(send).toHaveBeenLastCalledWith(nextKey, payload);
  });
  it('never treats a transport rejection as nonexecution or permits clearing it', async () => {
    const f = fixture(), c = f.make();
    const send = vi.fn(async () => { throw new Error('Ответ не получен'); });
    expect((await c.submit(payload, send)).status).toBe('hold');
    expect(() => c.newIntent()).toThrow();
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('holds changed payload without sending another request', async () => {
    const f = fixture(); f.entries.set(slot, JSON.stringify(f.original));
    const c = f.make(); c.read(); const send = vi.fn();
    expect(await c.submit({ ...payload, quantityUnits: '3' }, send)).toMatchObject({ status: 'hold', blocked: true });
    expect(send).not.toHaveBeenCalled();
  });
  it('rejects expired authorization before persistence or dispatch', async () => {
    const f = fixture(), send = vi.fn();
    await expect(f.make(100).submit(payload, send)).rejects.toThrow('Войдите');
    expect(send).not.toHaveBeenCalled(); expect(f.entries.size).toBe(0);
  });
  it('fails closed if persistence cannot be read back before dispatch', async () => {
    const f = fixture(); f.storage.setItem = () => {};
    const send = vi.fn();
    expect(await f.make().submit(payload, send)).toMatchObject({ status: 'hold', blocked: true });
    expect(send).not.toHaveBeenCalled();
  });
  it('blocks concurrent submissions and dispatches once', async () => {
    const f = fixture(), c = f.make(); let finish!: () => void;
    const send = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const first = c.submit(payload, send);
    await expect(c.submit(payload, send)).rejects.toThrow();
    finish(); await first; expect(send).toHaveBeenCalledTimes(1);
  });
  it.each(['payload', 'createdAt'] as const)('rejects mismatched completion %s without hiding legacy', (field) => {
    const f = fixture(); f.entries.set(f.legacy, JSON.stringify(f.original));
    const proof = { ...f.original, status: 'confirmed', [field]: field === 'payload' ? { ...payload, quantityUnits: '99' } : 11 };
    f.entries.set(`${slot}:resolved:${key}`, JSON.stringify(proof));
    expect(() => f.make().read()).toThrow();
  });
  it('does not retire a distinct unresolved legacy key', () => {
    const f = fixture(); f.entries.set(slot, JSON.stringify(f.original));
    f.entries.set(f.legacy, JSON.stringify({ ...f.original, key: nextKey }));
    expect(() => f.make().read()).toThrow();
  });
  it('ignores legacy belonging to a different owner', () => {
    const f = fixture(); f.entries.set(`bar:retail:v1:${JSON.stringify(['other', ...parts.slice(1)])}`, JSON.stringify(f.original));
    expect(f.make().read()).toBeNull();
  });
  it('preserves confirmed result but blocks reset when completion marker storage fails', async () => {
    const f = fixture(), c = f.make(); await c.submit(payload, async () => {});
    f.storage.setItem = () => { throw new Error('Storage unavailable'); };
    expect(() => c.newIntent()).toThrow();
    expect(JSON.parse(f.entries.get(slot)!)).toMatchObject({ status: 'confirmed' });
  });
  it.each(['0', '-1', '1.5', '9223372036854775808'])('rejects invalid draft quantity %s', quantityUnits => {
    expect(() => validateRetailDraft({ ...payload, quantityUnits }, [key], ['CASH'])).toThrow();
  });
  it('accepts bigint limit without rounding and rejects unavailable product/method', () => {
    expect(() => validateRetailDraft({ ...payload, quantityUnits: '9223372036854775807' }, [key], ['CASH'])).not.toThrow();
    expect(() => validateRetailDraft(payload, [], ['CASH'])).toThrow();
    expect(() => validateRetailDraft(payload, [key], [])).toThrow();
  });
});
