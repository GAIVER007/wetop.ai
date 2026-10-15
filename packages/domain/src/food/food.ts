import { createHash } from 'node:crypto';
export const FOOD_STATUSES = [
  'BOOKED',
  'CONFIRMED',
  'SEATED',
  'COMPLETED',
  'NO_SHOW',
  'CANCELLED',
] as const;
export type FoodStatus = (typeof FOOD_STATUSES)[number];
export const FOOD_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function foodNext(status: FoodStatus): FoodStatus[] {
  return (
    {
      BOOKED: ['CONFIRMED', 'SEATED', 'CANCELLED', 'NO_SHOW'],
      CONFIRMED: ['SEATED', 'CANCELLED', 'NO_SHOW'],
      SEATED: ['COMPLETED'],
      COMPLETED: [],
      NO_SHOW: [],
      CANCELLED: [],
    } as Record<FoodStatus, FoodStatus[]>
  )[status];
}
export const foodCapacity = (party: number, capacity: number) => party > 0 && party <= capacity;
export function foodObject(raw: unknown, allowed: string[]): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Пришлите объект');
  const b = raw as Record<string, unknown>;
  if (Object.keys(b).some((k) => !allowed.includes(k))) throw new Error('Неизвестное поле запроса');
  return b;
}
export function foodText(v: unknown, max: number): string {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > max)
    throw new Error('Некорректный текст');
  return v.trim();
}
export function foodId(v: unknown): string {
  if (typeof v !== 'string' || !FOOD_UUID.test(v)) throw new Error('Некорректный идентификатор');
  return v.toLowerCase();
}
export function foodInt(v: unknown, min = 1, max = 2147483647): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max)
    throw new Error('Некорректное целое число');
  return v;
}
export function foodInstant(v: unknown): string {
  if (
    typeof v !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(v) ||
    !Number.isFinite(Date.parse(v))
  )
    throw new Error('Нужна дата и время с часовым поясом');
  const date = v.slice(0, 10);
  if (
    new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date ||
    Number(v.slice(11, 13)) > 23
  )
    throw new Error('Некорректная календарная дата');
  return new Date(v).toISOString();
}
export function foodClock(v: unknown): string {
  if (typeof v !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v))
    throw new Error('Время в формате ЧЧ:ММ');
  return v;
}
export type FoodCatalogKind = 'area' | 'table' | 'period';
export interface FoodCatalogInput {
  name?: string;
  sortOrder?: number;
  active?: boolean;
  areaId?: string;
  capacity?: number;
  weekday?: number;
  timeFrom?: string;
  timeTo?: string;
  endsNextDay?: boolean;
  defaultDurationMinutes?: number;
}
export function parseFoodCatalog(
  kind: FoodCatalogKind,
  raw: unknown,
  partial = false,
): FoodCatalogInput {
  const keys =
    kind === 'area'
      ? ['name', 'sortOrder', 'active']
      : kind === 'table'
        ? ['areaId', 'name', 'capacity', 'sortOrder', 'active']
        : [
            'name',
            'weekday',
            'timeFrom',
            'timeTo',
            'endsNextDay',
            'defaultDurationMinutes',
            'active',
          ];
  const b = foodObject(raw, partial ? keys.filter((k) => k !== 'areaId') : keys);
  const out: FoodCatalogInput = {};
  if (!partial || b.name !== undefined) out.name = foodText(b.name, kind === 'area' ? 200 : 100);
  if (b.sortOrder !== undefined) out.sortOrder = foodInt(b.sortOrder, -2147483648);
  for (const k of ['active', 'endsNextDay'] as const)
    if (b[k] !== undefined) {
      if (typeof b[k] !== 'boolean') throw new Error('Нужно логическое значение');
      out[k] = b[k];
    }
  if (kind === 'table') {
    if (!partial) out.areaId = foodId(b.areaId);
    if (!partial || b.capacity !== undefined) out.capacity = foodInt(b.capacity);
  }
  if (kind === 'period') {
    if (!partial || b.weekday !== undefined) out.weekday = foodInt(b.weekday, 0, 6);
    if (!partial || b.timeFrom !== undefined) out.timeFrom = foodClock(b.timeFrom);
    if (!partial || b.timeTo !== undefined) out.timeTo = foodClock(b.timeTo);
    if (!partial || b.defaultDurationMinutes !== undefined)
      out.defaultDurationMinutes = foodInt(b.defaultDurationMinutes);
    if (!partial && !out.endsNextDay && out.timeTo! <= out.timeFrom!)
      throw new Error('Конец периода должен быть позже начала');
  }
  return out;
}
export interface FoodCreate {
  servicePeriodId: string;
  startsAt: string;
  partySize: number;
  customerId?: string;
  customer?: { firstName: string; lastName: string | null; phone: string | null };
  tableId: string | null;
  notes: string | null;
  source: 'DESK' | 'WALK_IN';
}
export function parseFoodCreate(raw: unknown): FoodCreate {
  const b = foodObject(raw, [
    'servicePeriodId',
    'startsAt',
    'partySize',
    'customerId',
    'customer',
    'tableId',
    'notes',
    'source',
  ]);
  if ((b.customerId !== undefined) === (b.customer !== undefined))
    throw new Error('Выберите клиента или создайте нового');
  const out: FoodCreate = {
    servicePeriodId: foodId(b.servicePeriodId),
    startsAt: foodInstant(b.startsAt),
    partySize: foodInt(b.partySize),
    tableId: b.tableId == null ? null : foodId(b.tableId),
    notes: b.notes == null ? null : foodText(b.notes, 4000),
    source: 'DESK',
  };
  if (b.source !== undefined && b.source !== 'DESK' && b.source !== 'WALK_IN')
    throw new Error('Неизвестный источник');
  out.source = (b.source ?? 'DESK') as FoodCreate['source'];
  if (out.source === 'WALK_IN' && !out.tableId) throw new Error('Для walk-in нужен стол');
  if (b.customerId !== undefined) out.customerId = foodId(b.customerId);
  else {
    const c = foodObject(b.customer, ['firstName', 'lastName', 'phone']);
    out.customer = {
      firstName: foodText(c.firstName, 100),
      lastName: c.lastName == null ? null : foodText(c.lastName, 100),
      phone: c.phone == null ? null : foodText(c.phone, 32),
    };
  }
  return out;
}
export const foodFingerprint = (input: FoodCreate) =>
  createHash('sha256').update(JSON.stringify(input)).digest('hex');
export function foodLocal(at: Date, tz: string): { date: string; stamp: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (k: string) => parts.find((p) => p.type === k)!.value;
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  return {
    date,
    stamp:
      Date.parse(`${date}T${get('hour')}:${get('minute')}:${get('second')}Z`) +
      at.getUTCMilliseconds(),
  };
}
export interface FoodPeriod {
  weekday: number;
  timeFrom: string;
  timeTo: string;
  endsNextDay: boolean;
  defaultDurationMinutes: number;
}
export function foodEnd(period: FoodPeriod, startsAt: string, tz: string): Date {
  const start = new Date(startsAt),
    end = new Date(start.getTime() + period.defaultDurationMinutes * 60000);
  if (!Number.isFinite(end.getTime())) throw new Error('Некорректная длительность');
  const local = foodLocal(start, tz),
    finish = foodLocal(end, tz).stamp;
  const midnight = Date.parse(local.date + 'T00:00:00Z');
  const mins = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  for (const offset of [0, -1]) {
    const day = midnight + offset * 86400000;
    if (new Date(day).getUTCDay() !== period.weekday) continue;
    const from = day + mins(period.timeFrom) * 60000,
      to = day + (period.endsNextDay ? 86400000 : 0) + mins(period.timeTo) * 60000;
    if (local.stamp >= from && local.stamp < to && finish <= to && finish >= from) return end;
  }
  throw new Error('Бронь не помещается в период обслуживания');
}
