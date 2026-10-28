import { msg, translator, type Translate } from '../i18n';

/**
 * Период Главной (владелец 29.10.2026: «оставь только месяц переключать и выбор свой период от–до»):
 * текущий месяц по умолчанию, `month:YYYY-MM` листается стрелками, `range:от..до` из календаря. Даты проверяет сервер.
 */
export type OwnerPeriod = 'today' | 'week' | 'month' | `month:${string}` | `range:${string}`;
export function ownerPeriod(value: unknown): OwnerPeriod {
  if (value === 'month') return 'month';
  if (typeof value === 'string' && /^month:\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value as OwnerPeriod;
  if (typeof value === 'string' && /^range:\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}$/.test(value)) return value as OwnerPeriod;
  return 'month';
}
/** Месяц для стрелок: из `month:YYYY-MM`, у «month» и своего периода месяц его начала */
export function ownerMonth(fromDate: string, key: string): string {
  return /^month:\d{4}-\d{2}$/.test(key) ? key.slice(6) : fromDate.slice(0, 7);
}
export function shiftMonth(month: string, delta: number): string {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 7);
}
export type DailyMoney = { state: 'READY' | 'PARTIAL' | 'UNAVAILABLE'; reason: string | null; unresolvedSources?: number; currencies: {currency:string;amountMinor:string}[] | null; days: {date:string;unresolvedSources:number;currencies:{currency:string;amountMinor:string}[]}[] | null };
type Money = {
  daily?: DailyMoney;
  state: 'READY' | 'PARTIAL' | 'UNAVAILABLE';
  reason: string | null;
  unresolvedSources?: number;
  currencies: { currency: string; amountMinor: string }[] | null;
};
type Expenses = Omit<Money, 'currencies'> & {
  currencies:
    | {
        currency: string;
        paidMinor: string;
        categories: { categoryId: string | null; categoryName: string; paidMinor: string }[];
      }[]
    | null;
};
export type Workload = {
  state: string;
  reason: string | null;
  basis?: string;
  unit?: string;
  numerator: string | null;
  denominator: string | null;
  percent?: number | null;
  coverage: unknown[];
  funds?: {
    unit: string;
    state: string;
    numerator: string | null;
    denominator: string | null;
    percent: null;
  }[];
  requestedFromUtc?: string;
  requestedToUtc?: string | null;
  requestedFromDate?: string;
  requestedToDate?: string;
  calculationVersion?: string;
  sourceRevisions?: string[];
  coveredPercent?: number | null;
};
/** Строка «Требуют решения»: дела СЕГОДНЯ филиала, считает API (`apps/api/src/finance/owner-attention.ts`) */
export interface OwnerAttentionItem {
  id: string;
  tone: 'warn' | 'ok';
  text: string;
  href: string;
  action: string;
  count?: number;
}
export interface OwnerSummaryDto {
  sourceVersion: 'owner-cash-foundation-v1';
  generatedAt: string;
  state: 'PARTIAL';
  scope: { locationId: string; organizationId: string; vertical: string };
  period: {
    key: string;
    timezone: string;
    fromDate: string;
    toDate: string;
    fromUtc: string;
    toUtc: string;
    isFinalized: false;
  };
  current: { revenue: Money; receipts: Money; paidExpenses: Expenses };
  previous: ({period: OwnerSummaryDto['period'] & {policy: 'SAME_LOCAL_WALL_CLOCK'}} & OwnerSummaryDto['current']) | null;
  comparisons?: Record<keyof OwnerSummaryDto['current'], {reason:string|null;currencies:{currency:string;deltaMinor:string|null;rateBasisPoints:string|null;reason:string|null}[]|null}>;
  comparisonReason: string | null;
  classificationReason: string | null;
  classificationState?: 'READY' | 'PARTIAL' | 'UNAVAILABLE';
  workload: Workload;
  /** нет у старого API: тогда блок честно говорит, что сигналы недоступны */
  attention?: OwnerAttentionItem[];
}
/** Decimal-safe formatting: never convert money to Number, including very large balances. */
/**
 * Деньги Главной в том же виде, что на остальных экранах (аудит 22.10.2026 P1-1: было «50 000,00 KZT»): знак ₸ для
 * тенге, копейки только когда они есть, минус настоящий. BigInt без float (ADR-008).
 */
export function formatOwnerMoney(minor: string, currency: string): string {
  const digits =
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  const amount = BigInt(minor),
    absolute = amount < 0n ? -amount : amount,
    scale = 10n ** BigInt(digits),
    fraction = absolute % scale;
  const whole = new Intl.NumberFormat('ru-RU').format(absolute / scale);
  const tail = digits && fraction ? ',' + fraction.toString().padStart(digits, '0') : '';
  return `${amount < 0n ? '−' : ''}${whole}${tail} ${currency === 'KZT' ? '₸' : currency}`;
}
export const ownerSummaryEnabled = (value: string | undefined) => value === 'true';
export function ownerReason(reason: string | null | undefined, t: Translate = translator('ru')): string {
  const words: Record<string, string> = {
    UNKNOWN_SOURCE_CURRENCY: msg('Валюта части операций неизвестна. Показана только известная часть.'),
    PAYMENT_LEDGER_NOT_AVAILABLE: msg('Реестр оплат не подключён'),
    NO_MONEY_DATA: msg('Нет денежных операций за выбранный период'),
    COMPARABLE_PROJECTION_NOT_CONNECTED: msg('Нет сопоставимых данных'),
    PREVIOUS_PERIOD_UNAVAILABLE: msg('Нет данных за предыдущий период'),
    PREVIOUS_AMOUNT_ZERO: msg('Предыдущая сумма равна нулю'),
    EXPENSE_DOCUMENT_LINKS_NOT_CONNECTED: msg('Статьи расходов не подключены'),
    UNCLASSIFIED_EXPENSE_SOURCES: msg('Часть расходов без статьи'),
    INCOMPLETE_PERIOD_COVERAGE: msg('Неполное покрытие периода'),
    CAPTURE_DISABLED: msg('Сбор истории загрузки отключён'),
    CAPTURE_DISABLED_OR_NO_PROPERTY: msg('Сбор истории отключён или объект не связан'),
    HISTORY_NOT_CAPTURED: msg('История не накоплена'),
    OBSERVED_SOURCE_NOT_COMPLETE_HISTORY: msg('Наблюдения не подтверждают полную историю периода'),
    NO_SCHEDULE: msg('Нет сохранённого расписания'),
    NO_AVAILABLE_CAPACITY_OR_SCHEDULE: msg('Нет доступной мощности или расписания'),
    UNSUPPORTED_SOURCE: msg('Источник не поддерживается'),
    UNSUPPORTED_VERTICAL: msg('Направление не поддерживается'),
  };
  if (!reason) return '';
  const known = words[reason];
  return known ? t(known) : t('Данные недоступны: {reason}', { reason });
}
