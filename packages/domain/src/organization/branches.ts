import type { DashboardPeriod } from '../dashboard/metrics';

/**
 * Филиалы организации (Platform P3, ADR-130; план `plans/platform-p3-branches-2026-10-01.md`).
 *
 * Филиал, `Location` утверждённой модели (DATA_MODEL §18) со своим объектом Hospitality. Здесь, чистые правила:
 * разбор формы «Добавить филиал» (одна функция для стойки и API, причина, у поля) и итог сводки по филиалам
 * (`ARCHITECTURE.md` §10: универсальные величины складываются снизу вверх, деньги, только внутри одной валюты).
 */
export interface BranchInput {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  /** IANA, «Asia/Almaty»: границы ночей объекта (AGENTS.md §13) */
  timezone: string;
  /** Операционная валюта филиала, три латинские буквы в верхнем регистре */
  currency: string;
}

export type BranchInputField = keyof BranchInput;

export type BranchInputParse =
  | { ok: true; value: BranchInput }
  | { ok: false; reason: string; field?: BranchInputField };

const NAME_MIN = 2;
const NAME_MAX = 200;
const ADDRESS_MAX = 500;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CURRENCY = /^[A-Za-z]{3}$/;

const text = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  return s === '' ? null : s;
};

/** Часовой пояс настоящий, его знает `Intl`; иначе «Asia/Almaty» с опечаткой молча сломал бы границы ночей */
export function isIanaTimezone(v: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: v });
    return true;
  } catch {
    return false;
  }
}

/**
 * Разбор формы филиала. Умолчания (`defaults`), часовой пояс и валюта первого филиала организации: второй филиал в том
 * же городе их не набирает. Пустые адрес, телефон и почта, `null`, как у объекта (DATA_MODEL §1, v1.7).
 */
export function parseBranchInput(
  raw: unknown,
  defaults: { timezone: string; currency: string },
): BranchInputParse {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'Нечего сохранять' };
  const body = raw as Record<string, unknown>;
  const name = text(body.name);
  if (name === null) return { ok: false, reason: 'Укажите название филиала', field: 'name' };
  if (name.length < NAME_MIN)
    return { ok: false, reason: `Название, не короче ${NAME_MIN} знаков`, field: 'name' };
  if (name.length > NAME_MAX)
    return { ok: false, reason: `Название, не длиннее ${NAME_MAX} знаков`, field: 'name' };
  const address = text(body.address);
  if (address !== null && address.length > ADDRESS_MAX)
    return { ok: false, reason: `Адрес, не длиннее ${ADDRESS_MAX} знаков`, field: 'address' };
  const phone = text(body.phone);
  const digits = phone?.replace(/\D/g, '').length ?? 0;
  if (phone !== null && (digits < 5 || digits > 15))
    return { ok: false, reason: 'Телефон, от 5 до 15 цифр', field: 'phone' };
  const email = text(body.email)?.toLowerCase() ?? null;
  if (email !== null && !EMAIL.test(email))
    return { ok: false, reason: 'Почта, в виде name@example.kz', field: 'email' };
  const timezone = text(body.timezone) ?? defaults.timezone;
  if (!isIanaTimezone(timezone))
    return { ok: false, reason: 'Часовой пояс, в виде Asia/Almaty', field: 'timezone' };
  const currencyRaw = text(body.currency) ?? defaults.currency;
  if (!CURRENCY.test(currencyRaw))
    return { ok: false, reason: 'Валюта, три латинские буквы, например KZT', field: 'currency' };
  return {
    ok: true,
    value: { name, address, phone, email, timezone, currency: currencyRaw.toUpperCase() },
  };
}

/** Строка сводки: филиал и его показатели за период; `null`, у филиала нет объекта или показатели не посчитались */
export interface BranchPeriod {
  locationId: string;
  currency: string;
  period: DashboardPeriod | null;
}

/** Деньги итога, по валютам: курса пересчёта в отчётную валюту нет (Q-238), а складывать тенге с дирхамами нельзя */
export interface BranchMoneyTotal {
  currency: string;
  revenueMinor: string;
  paymentsMinor: string;
  refundsMinor: string;
  /** Средняя цена ночи по филиалам этой валюты; null, проданных ночей не было */
  adrMinor: string | null;
  /** Доход на единицу за ночь по филиалам этой валюты; null, единиц не было */
  revparMinor: string | null;
}

export interface BranchesTotal {
  /** Сколько филиалов вошло в сводку (с объектом и без) */
  branches: number;
  /** Ночи фонда суммой; процент, взвешенно: занятые ночи всех филиалов к ночам фонда всех филиалов */
  occupancy: DashboardPeriod['occupancy'];
  arrivals: number;
  bookings: number;
  money: BranchMoneyTotal[];
}

const percent = (part: number, whole: number) =>
  whole > 0 ? Math.round((part * 1000) / whole) / 10 : 0;
const divide = (amount: bigint, by: number): string | null =>
  by > 0 ? (amount / BigInt(by)).toString() : null;

export function summarizeBranches(rows: BranchPeriod[]): BranchesTotal {
  const occupancy = { unitNights: 0, occupiedNights: 0, blockedNights: 0, freeNights: 0 };
  let arrivals = 0;
  let bookings = 0;
  const byCurrency = new Map<
    string,
    { revenue: bigint; accommodation: bigint; payments: bigint; refunds: bigint; occupied: number; units: number }
  >();
  for (const row of rows) {
    const p = row.period;
    if (!p) continue;
    occupancy.unitNights += p.occupancy.unitNights;
    occupancy.occupiedNights += p.occupancy.occupiedNights;
    occupancy.blockedNights += p.occupancy.blockedNights;
    occupancy.freeNights += p.occupancy.freeNights;
    arrivals += p.arrivals.count;
    bookings += p.bookings.total;
    const bucket = byCurrency.get(row.currency) ?? {
      revenue: 0n,
      accommodation: 0n,
      payments: 0n,
      refunds: 0n,
      occupied: 0,
      units: 0,
    };
    bucket.revenue += BigInt(p.revenue.totalMinor);
    bucket.accommodation += BigInt(p.revenue.accommodationMinor);
    bucket.payments += BigInt(p.payments.totalMinor);
    bucket.refunds += BigInt(p.refundsMinor);
    bucket.occupied += p.occupancy.occupiedNights;
    bucket.units += p.occupancy.unitNights;
    byCurrency.set(row.currency, bucket);
  }
  return {
    branches: rows.length,
    occupancy: { ...occupancy, percent: percent(occupancy.occupiedNights, occupancy.unitNights) },
    arrivals,
    bookings,
    money: [...byCurrency.entries()].map(([currency, b]) => ({
      currency,
      revenueMinor: b.revenue.toString(),
      paymentsMinor: b.payments.toString(),
      refundsMinor: b.refunds.toString(),
      adrMinor: divide(b.accommodation, b.occupied),
      revparMinor: divide(b.accommodation, b.units),
    })),
  };
}
