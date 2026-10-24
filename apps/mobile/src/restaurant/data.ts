import { AccessError } from '../auth/contracts';
import type { RestaurantTables, RestaurantOrders } from './contracts';
function obj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new AccessError('invalid');
  return v as Record<string, unknown>;
}
function str(v: unknown): string {
  if (typeof v !== 'string') throw new AccessError('invalid');
  return v;
}
function num(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new AccessError('invalid');
  return v;
}
function bool(v: unknown): boolean {
  if (typeof v !== 'boolean') throw new AccessError('invalid');
  return v;
}
function list<T>(v: unknown, read: (x: unknown) => T): T[] {
  if (!Array.isArray(v)) throw new AccessError('invalid');
  return v.map(read);
}
function person(v: unknown) {
  if (v === null) return null;
  const x = obj(v);
  return { id: str(x.id), name: str(x.name) };
}
function minor(v: unknown): string {
  const s = str(v);
  if (!/^-?\d+$/.test(s)) throw new AccessError('invalid');
  return s;
}
export function readTables(value: unknown): RestaurantTables {
  const v = obj(value);
  return {
    me: person(v.me),
    tables: list(v.tables, (value) => {
      const t = obj(value);
      return {
        id: str(t.id),
        name: str(t.name),
        capacity: num(t.capacity),
        areaName: str(t.areaName),
        busy: bool(t.busy),
        mine: bool(t.mine),
        needsCleaning: bool(t.needsCleaning),
      };
    }),
  };
}
export function readOrders(value: unknown): RestaurantOrders {
  const v = obj(value);
  return {
    nextCursor: v.nextCursor === null ? null : str(v.nextCursor),
    items: list(v.items, (value) => {
      const o = obj(value);
      return {
        id: str(o.id),
        number: num(o.number),
        status: str(o.status),
        table: person(o.table),
        waiter: person(o.waiter),
        guestCount: num(o.guestCount),
        totalMinor: minor(o.totalMinor),
        paidMinor: minor(o.paidMinor),
        currency: str(o.currency),
        updatedAt: str(o.updatedAt),
        delayed: bool(o.delayed),
        items: list(o.items, (value) => {
          const i = obj(value);
          return {
            id: str(i.id),
            name: str(i.name),
            qty: num(i.qty),
            priceMinor: minor(i.priceMinor),
            ...(i.station !== undefined ? { station: str(i.station) } : {}),
            ...(i.status !== undefined ? { status: str(i.status) } : {}),
          };
        }),
      };
    }),
  };
}
export function money(value: string, currency: string): string {
  const raw = minor(value);
  if (!/^[A-Z]{3}$/.test(currency)) throw new AccessError('invalid');
  const fmt = new Intl.NumberFormat('ru-RU', { style: 'currency', currency });
  const digits = fmt.resolvedOptions().maximumFractionDigits ?? 2;
  const negative = raw.startsWith('-');
  const padded = BigInt(negative ? raw.slice(1) : raw)
    .toString()
    .padStart(digits + 1, '0');
  const whole = digits ? padded.slice(0, -digits) : padded;
  const fraction = digits ? padded.slice(-digits) : '';
  const symbol =
    currency === 'KZT'
      ? '₸'
      : (fmt.formatToParts(0).find((p) => p.type === 'currency')?.value ?? currency);
  return `${negative ? '−' : ''}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')}${/[1-9]/.test(fraction) ? ',' + fraction : ''}\u00a0${symbol}`;
}
