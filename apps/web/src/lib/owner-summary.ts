export type OwnerPeriod = 'today' | 'week' | 'month';
export function ownerPeriod(value: unknown): OwnerPeriod {
  return value === 'week' || value === 'month' ? value : 'today';
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
    key: OwnerPeriod;
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
export function formatOwnerMoney(minor: string, currency: string): string {
  const digits =
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  const amount = BigInt(minor),
    absolute = amount < 0n ? -amount : amount,
    scale = 10n ** BigInt(digits);
  return `${amount < 0n ? '-' : ''}${new Intl.NumberFormat('ru-RU').format(absolute / scale)}${digits ? ',' + (absolute % scale).toString().padStart(digits, '0') : ''} ${currency}`;
}
export const ownerSummaryEnabled = (value: string | undefined) => value === 'true';
export function ownerReason(reason: string | null | undefined): string {
  const words: Record<string, string> = {
    UNKNOWN_SOURCE_CURRENCY: 'Валюта части операций неизвестна. Показана только известная часть.',
    PAYMENT_LEDGER_NOT_AVAILABLE: 'Реестр оплат не подключён',
    NO_MONEY_DATA: 'Нет денежных операций за выбранный период',
    COMPARABLE_PROJECTION_NOT_CONNECTED: 'Нет сопоставимых данных',
    PREVIOUS_PERIOD_UNAVAILABLE: 'Нет данных за предыдущий период',
    PREVIOUS_AMOUNT_ZERO: 'Предыдущая сумма равна нулю',
    EXPENSE_DOCUMENT_LINKS_NOT_CONNECTED: 'Статьи расходов не подключены',
    UNCLASSIFIED_EXPENSE_SOURCES: 'Часть расходов без статьи',
    INCOMPLETE_PERIOD_COVERAGE: 'Неполное покрытие периода',
    CAPTURE_DISABLED: 'Сбор истории загрузки отключён',
    CAPTURE_DISABLED_OR_NO_PROPERTY: 'Сбор истории отключён или объект не связан',
    HISTORY_NOT_CAPTURED: 'История не накоплена',
    OBSERVED_SOURCE_NOT_COMPLETE_HISTORY: 'Наблюдения не подтверждают полную историю периода',
    NO_SCHEDULE: 'Нет сохранённого расписания',
    NO_AVAILABLE_CAPACITY_OR_SCHEDULE: 'Нет доступной мощности или расписания',
    UNSUPPORTED_SOURCE: 'Источник не поддерживается',
    UNSUPPORTED_VERTICAL: 'Направление не поддерживается',
  };
  return reason ? (words[reason] ?? `Данные недоступны: ${reason}`) : '';
}
