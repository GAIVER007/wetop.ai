import { RESULT_CHANNELS, buildMarketingFunnel, type ChannelResult } from '@pms/domain';
import type { MarketingCampaignView, MarketingResultsView } from '../../../lib/api';
import { translator, type Translate } from '../../../i18n';
import type { BudgetExpense } from './derive';

/**
 * Сводка «Бюджет и аналитика» (решение владельца 20.10.2026, `docs/decisions/2026-10-20-budget-analytics-summary.md`):
 * чистый расчёт поверх трёх настоящих ответов API (`/marketing/budget`, `/marketing/campaigns`, `/marketing/results`),
 * своих запросов нет. Деньги BigInt в minor units (ADR-008), делим целыми с округлением к ближайшему.
 *
 * Правила:
 * - **ручной расход**: учтённые строки журнала «Бюджета» в валюте отчётности (как «Израсходовано» обзора);
 * - **расход кабинета**: дни кампаний кабинета (§55, `cabinetSpend`) в валюте кабинета, по валютам раздельно.
 *   С ручным расходом **не складывается**: правила сложения нет (Q-MKT-SUM), оплата счёта Meta в журнале это те же
 *   деньги, что у кабинета;
 * - **заявки**: обращения каналов из своих данных (`/marketing/results`, Q-MKT-ATTR); лиды площадки у строки кабинета
 *   отдельно и в итог не входят (это заявки по данным площадки, §53);
 * - **цена заявки**: ручной расход на заявку (как CPL «Аналитики»); у строки кабинета расход кабинета на лид площадки
 *   (CPL площадки §53) в валюте кабинета;
 * - **ROMI**: (выручка − ручной расход) / ручной расход, только где выручка известна и в той же валюте.
 * Чего нет, то `null` с причиной словами; ноль и деление на ноль не выдаются за результат.
 */

export interface Metric<T> {
  value: T | null;
  /** Почему значения нет; null, если есть */
  reason: string | null;
}

export interface MoneyMetric extends Metric<bigint> {
  currency: string;
}

/** Расход кабинета одной валюты: сумма дней и лиды площадки за месяц */
export interface CabinetSum {
  currency: string;
  amountMinor: bigint;
  leads: number;
}

export interface ChannelSummary {
  platform: string;
  /** Учтённый ручной расход канала в валюте отчётности */
  manualSpendMinor: bigint;
  /** Расход кабинета по валютам; пусто, когда кабинета у канала нет */
  cabinet: CabinetSum[];
  /** Заявки канала; `platform: true`: это лиды площадки по данным кабинета */
  requests: Metric<number> & { platform?: true };
  costPerRequest: MoneyMetric;
  revenue: MoneyMetric;
  romi: Metric<number>;
}

export interface BudgetSummary {
  manualSpend: MoneyMetric & { value: bigint };
  cabinetSpend: Metric<CabinetSum[]>;
  requests: Metric<number>;
  costPerRequest: MoneyMetric;
  revenue: MoneyMetric;
  romi: Metric<number>;
  /** Каналы с выручкой из своих данных первыми, затем реклама; внутри по ручному расходу */
  channels: ChannelSummary[];
}

const RESULT_SET = new Set<string>(RESULT_CHANNELS);

/** a / b целыми, к ближайшему; b > 0 */
const divRound = (a: bigint, b: bigint): bigint => (a * 2n + b) / (b * 2n);

const none = <T>(reason: string): Metric<T> => ({ value: null, reason });
const noneMoney = (currency: string, reason: string): MoneyMetric => ({ value: null, currency, reason });


/** Расход кабинета по валютам (валюты по алфавиту), только кампании кабинета */
function cabinetSums(campaigns: MarketingCampaignView[]): CabinetSum[] {
  const by = new Map<string, CabinetSum>();
  for (const c of campaigns) {
    if (c.fromCabinet !== true || c.cabinetSpend == null || !c.cabinetCurrency) continue;
    const sum = by.get(c.cabinetCurrency) ?? { currency: c.cabinetCurrency, amountMinor: 0n, leads: 0 };
    sum.amountMinor += BigInt(c.cabinetSpend);
    sum.leads += c.leads;
    by.set(c.cabinetCurrency, sum);
  }
  return [...by.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

export function budgetSummary(input: {
  view: { reportingCurrency: string; expenses: BudgetExpense[] };
  campaigns: MarketingCampaignView[] | 'error';
  results: MarketingResultsView | 'error';
  /** Причины словами на языке человека; без него русский */
  t?: Translate;
}): BudgetSummary {
  const t = input.t ?? translator('ru');
  const NO_SPEND = t('нет ручного расхода за месяц');
  const NO_CHANNEL_SPEND = t('нет ручного расхода по каналу');
  const NO_REQUESTS = t('нет заявок за месяц');
  const rc = input.view.reportingCurrency;
  const ok = input.results !== 'error' && input.results.supported;
  const res = ok ? (input.results as MarketingResultsView) : null;
  const resultsReason =
    input.results === 'error'
      ? t('результаты каналов не загрузились, обновите страницу')
      : t('нет данных: заявки и выручка по каналам пока считаются по броням гостиницы');

  const spendByPlatform: Record<string, bigint> = {};
  for (const e of input.view.expenses)
    if (e.countedInBudget) spendByPlatform[e.platform] = (spendByPlatform[e.platform] ?? 0n) + BigInt(e.baseAmount);
  const manual = Object.values(spendByPlatform).reduce((s, v) => s + v, 0n);

  // воронка «Аналитики»: те же CPL и ROMI каналов, чтобы числа экранов сходились
  const channels: ChannelResult[] = res
    ? res.channels.map((c) => ({ channel: c.channel, leads: c.leads, bookings: c.bookings, revenueMinor: BigInt(c.revenue) }))
    : [];
  const funnel = buildMarketingFunnel({
    spendByPlatform,
    channels,
    reportingCurrency: rc,
    revenueCurrency: res ? res.revenueCurrency : null,
  });
  const revenueCurrency = res?.revenueCurrency ?? rc;
  const currencyReason = t('выручка в {revenue}, расход в {spend}: сравнивать нельзя', { revenue: revenueCurrency, spend: rc });

  const campaigns = input.campaigns === 'error' ? [] : input.campaigns;
  const cabinetAll = cabinetSums(campaigns);
  const cabinetBy = new Map<string, CabinetSum[]>();
  for (const p of new Set(campaigns.map((c) => c.platform)))
    cabinetBy.set(p, cabinetSums(campaigns.filter((c) => c.platform === p)));

  // итог
  const requests: Metric<number> = res ? { value: funnel.total.leads, reason: null } : none(resultsReason);
  let costPerRequest: MoneyMetric;
  if (requests.value === null) costPerRequest = noneMoney(rc, requests.reason!);
  else if (manual === 0n) costPerRequest = noneMoney(rc, NO_SPEND);
  else if (requests.value === 0) costPerRequest = noneMoney(rc, NO_REQUESTS);
  else costPerRequest = { value: divRound(manual, BigInt(requests.value)), currency: rc, reason: null };
  const revenue: MoneyMetric = res
    ? { value: funnel.total.revenueMinor, currency: revenueCurrency, reason: null }
    : noneMoney(rc, resultsReason);
  let romi: Metric<number>;
  if (!res) romi = none(resultsReason);
  else if (!funnel.romiAvailable) romi = none(currencyReason);
  else if (manual === 0n) romi = none(NO_SPEND);
  else romi = { value: funnel.total.romiPct, reason: null };

  // каналы
  const rowsBy = new Map(funnel.rows.map((r) => [r.platform, r]));
  const platforms = new Set<string>([
    ...funnel.rows.map((r) => r.platform),
    ...[...cabinetBy.entries()].filter(([, sums]) => sums.length > 0).map(([p]) => p),
  ]);
  const rows: ChannelSummary[] = [...platforms].map((platform) => {
    const spend = spendByPlatform[platform] ?? 0n;
    const cabinet = cabinetBy.get(platform) ?? [];
    if (RESULT_SET.has(platform)) {
      const r = rowsBy.get(platform);
      if (!res || !r)
        return {
          platform,
          manualSpendMinor: spend,
          cabinet,
          requests: none(resultsReason),
          costPerRequest: noneMoney(rc, resultsReason),
          revenue: noneMoney(rc, resultsReason),
          romi: none(resultsReason),
        };
      const leads = r.leads ?? 0;
      return {
        platform,
        manualSpendMinor: spend,
        cabinet,
        requests: { value: leads, reason: null },
        costPerRequest:
          r.cplMinor !== null
            ? { value: r.cplMinor, currency: rc, reason: null }
            : noneMoney(rc, spend === 0n ? NO_CHANNEL_SPEND : t('нет заявок по каналу')),
        revenue: { value: r.revenueMinor, currency: revenueCurrency, reason: null },
        romi: !funnel.romiAvailable
          ? none(currencyReason)
          : r.romiPct === null
            ? none(NO_CHANNEL_SPEND)
            : { value: r.romiPct, reason: null },
      };
    }
    // реклама: своих заявок и выручки у канала нет (Q-MKT-ATTR), у кабинета есть лиды площадки
    const noRevenue = t('нет данных: выручка канала неизвестна, брони не несут метку кампании');
    let rowRequests: ChannelSummary['requests'] = none(t('нет данных: заявки канала не отмечаются'));
    let rowCost: MoneyMetric = noneMoney(rc, t('нет данных: заявки канала не отмечаются'));
    if (cabinet.length > 0) {
      const leads = cabinet.reduce((s, c) => s + c.leads, 0);
      rowRequests = { value: leads, reason: null, platform: true };
      if (cabinet.length > 1) rowCost = noneMoney(rc, t('кабинеты в разных валютах: не складываем'));
      else {
        const [one] = cabinet as [CabinetSum];
        rowCost =
          one.leads > 0 && one.amountMinor > 0n
            ? { value: divRound(one.amountMinor, BigInt(one.leads)), currency: one.currency, reason: null }
            : noneMoney(one.currency, one.leads > 0 ? t('нет расхода кабинета') : t('нет лидов площадки'));
      }
    }
    return {
      platform,
      manualSpendMinor: spend,
      cabinet,
      requests: rowRequests,
      costPerRequest: rowCost,
      revenue: noneMoney(rc, noRevenue),
      romi: none(noRevenue),
    };
  });
  rows.sort((a, b) => {
    const ar = RESULT_SET.has(a.platform);
    const br = RESULT_SET.has(b.platform);
    if (ar !== br) return ar ? -1 : 1;
    if (a.manualSpendMinor !== b.manualSpendMinor) return a.manualSpendMinor > b.manualSpendMinor ? -1 : 1;
    return a.platform.localeCompare(b.platform);
  });

  return {
    manualSpend: { value: manual, currency: rc, reason: null },
    cabinetSpend:
      input.campaigns === 'error'
        ? none(t('кампании «Рекламы» не загрузились, обновите страницу'))
        : { value: cabinetAll, reason: null },
    requests,
    costPerRequest,
    revenue,
    romi,
    channels: rows,
  };
}
