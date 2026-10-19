import { describe, expect, it } from 'vitest';
import { AppointmentMoneyOperation } from './appointment-money-operation';

const scope = JSON.stringify({ organizationId: 'org', businessId: 'business', locationId: 'location' });
const pay = { kind: 'pay' as const, method: 'CASH', amountMinor: 300000 };
const refund = { kind: 'refund' as const, method: 'CARD', amountMinor: 100000, reason: '  Тестовая причина  ' };
function fixture() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
  let count = 0;
  const uuid = () => `00000000-0000-4000-8000-${String(++count).padStart(12, '0')}`;
  const open = (context = scope, id = 'appointment') => new AppointmentMoneyOperation(context, id, storage, uuid);
  return { data, storage, open };
}
describe('Appointment money unknown-outcome lifecycle', () => {
  it('retries a partial payment using the identical frozen payload/key', () => {
    const f = fixture(); const op = f.open(); const first = op.begin(pay);
    expect(first).toMatchObject(pay); op.settle({ outcome: 'unknown', error: 'Lost response' });
    expect(op.status).toBe('unknown'); expect(op.begin({ ...pay, amountMinor: 1 })).toBeNull();
    expect(op.retry()).toEqual(first);
  });
  it('retains the exact trimmed refund reason and never persists form fields', () => {
    const f = fixture(); const op = f.open(); const first = op.begin(refund);
    op.settle({ error: 'Legacy error' }); expect(op.retry()).toEqual(first);
    expect(first).toMatchObject({ ...refund, reason: refund.reason.trim() });
    const persisted = JSON.stringify([...f.data]);
    for (const secret of [refund.reason.trim(), 'amountMinor', 'CARD', '100000']) expect(persisted).not.toContain(secret);
  });
  it('blocks synchronous duplicate clicks and cross-kind submissions', () => {
    const op = fixture().open(); expect(op.begin(pay)).not.toBeNull();
    expect(op.begin(pay)).toBeNull(); expect(op.begin(refund)).toBeNull(); expect(op.retry()).toBeNull();
  });
  it('does not erase a prior unknown after a rejected retry', () => {
    const op = fixture().open(); const first = op.begin(pay);
    op.settle({ outcome: 'unknown' }); expect(op.retry()).toEqual(first);
    expect(op.settle({ outcome: 'rejected', error: 'Session expired' })).toBe(false);
    expect(op.status).toBe('unknown'); expect(op.retry()).toEqual(first);
  });
  it('treats malformed/no-confirmation and legacy errors as unknown', () => {
    for (const result of [undefined, null, {}, { error: 'Error' }, { message: 'ok', error: 'Error' }]) {
      const op = fixture().open(); op.begin(pay); expect(op.settle(result)).toBe(false);
      expect(op.status).toBe('unknown');
    }
  });
  it('clears matching marker only on confirmed success, then permits a new installment', () => {
    const f = fixture(); const op = f.open(); const first = op.begin(pay);
    expect(op.settle({ message: 'Оплата принята' })).toBe(true); expect(f.data.size).toBe(0);
    expect(op.begin(pay)?.idempotencyKey).not.toBe(first?.idempotencyKey);
  });
  it('reopening an unresolved operation blocks replacement input and replay', () => {
    const f = fixture(); const op = f.open(); op.begin(refund); op.settle({ outcome: 'unknown' });
    const reopened = f.open(); expect(reopened.status).toBe('blocked');
    expect(reopened.begin({ ...refund, reason: 'replacement' })).toBeNull(); expect(reopened.retry()).toBeNull();
    expect(f.data.size).toBe(1);
  });
  it('isolates scope and appointment without deleting the old unresolved marker', () => {
    const f = fixture(); f.open().begin(pay);
    expect(f.open(scope, 'another').status).toBe('idle');
    expect(f.open(JSON.stringify({ ...JSON.parse(scope), locationId: 'another-location' })).status).toBe('idle');
    expect(f.open().status).toBe('blocked'); expect(f.data.size).toBe(1);
  });
  it('fails closed on missing scope, invalid scope and inaccessible storage', () => {
    const f = fixture();
    for (const s of ['', 'bad-json', '{}']) expect(f.open(s).begin(pay)).toBeNull();
    const inaccessible = { ...f.storage, setItem() { throw new Error('blocked'); } };
    const op = new AppointmentMoneyOperation(scope, 'appointment', inaccessible);
    expect(op.begin(pay)).toBeNull(); expect(op.status).toBe('blocked');
  });
  it('a fresh local rejection is safe to clear, but a foreign marker must never be removed', () => {
    const f = fixture(); const op = f.open(); op.begin(pay);
    expect(op.settle({ outcome: 'rejected', error: 'Preflight failed' })).toBe(false);
    expect(op.status).toBe('idle'); expect(f.data.size).toBe(0);
    op.begin(pay); for (const key of f.data.keys()) f.data.set(key, 'another-operation');
    expect(op.settle({ message: 'Оплата принята' })).toBe(true);
    expect([...f.data.values()]).toEqual(['another-operation']); expect(op.status).toBe('blocked');
  });
});
