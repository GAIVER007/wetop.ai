import { AccessError } from '../auth/contracts';
import type { CashSummary } from './contracts';
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AccessError('invalid');
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== 'string') throw new AccessError('invalid');
  return value;
}
function minor(value: unknown, signed = false): string {
  const v = string(value);
  if (!(signed ? /^-?\d+$/ : /^\d+$/).test(v)) throw new AccessError('invalid');
  return v;
}
function list<T>(value: unknown, reader: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new AccessError('invalid');
  return value.map(reader);
}
export function readCash(value: unknown): CashSummary {
  const v = record(value);
  return {
    currency: string(v.currency),
    balances: list(v.balances, (value) => {
      const b = record(value);
      return { method: string(b.method), balanceMinor: minor(b.balanceMinor, true) };
    }),
    payments: list(v.payments, (value) => {
      const p = record(value);
      if (!Number.isSafeInteger(p.orderNumber) || Number(p.orderNumber) < 1)
        throw new AccessError('invalid');
      return {
        id: string(p.id),
        orderNumber: p.orderNumber as number,
        method: string(p.method),
        amountMinor: minor(p.amountMinor),
        status: string(p.status),
        paidAt: string(p.paidAt),
      };
    }),
  };
}
