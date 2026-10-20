import { unstable_rethrow } from 'next/navigation';
import type { SearchParams } from '../../../lib/search-params';
import { requireFeature } from '../../../lib/vertical-guard';
import { formatMoney } from '../../../lib/money';
import { verticalCopy } from '../../../lib/vertical-copy';
import {
  marketingBudgetApi,
  marketingCampaignsApi,
  type MarketingCampaignView,
  type MarketingResultsView,
} from '../../../lib/api';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { Badge, SectionTitle, Stat, Stats, Table } from '../../../components/ui';
import { BackToModules } from '../parts';
import '../marketing.css';
import './budget.css';
import { loadBudget } from './load';
import { BUDGET_TITLE, BudgetTabs, ChooseLocation, MonthNav, platformLabel } from './parts';
import { budgetSummary, type CabinetSum, type Metric, type MoneyMetric } from './summary';

/**
 * «Бюджет и аналитика → Сводка» (решение владельца 20.10.2026, `docs/decisions/2026-10-20-budget-analytics-summary.md`):
 * один экран ответа «сколько потратили и что это принесло». Расход вручную (журнал «Бюджета») и расход кабинета Meta
 * (§55) стоят раздельно и не складываются (Q-MKT-SUM); заявки, цена заявки и ROMI по каналам считает `summary.ts`.
 * Данные из трёх настоящих ответов API; упал один источник, остальное показывается, а пропуск назван словами.
 */
const quiet = async <T,>(p: Promise<T>): Promise<T | 'error'> => {
  try {
    return await p;
  } catch (error) {
    unstable_rethrow(error);
    return 'error';
  }
};

const NO_DATA = 'Нет данных';
const romiText = (v: number) => `${v > 0 ? '+' : ''}${v} %`;
const cabinetText = (sums: CabinetSum[]) => sums.map((s) => formatMoney(s.amountMinor, s.currency)).join(', ');

/** Ячейка с пропуском: «нет данных» и причина для программы чтения и подсказкой при наведении */
function Missing({ reason }: { reason: string | null }) {
  return (
    <span className="budget-cell-missing" title={reason ?? undefined}>
      {NO_DATA}
      {reason && <span className="sr-only">: {reason}</span>}
    </span>
  );
}

const moneyCell = (m: MoneyMetric) => (m.value === null ? <Missing reason={m.reason} /> : formatMoney(m.value, m.currency));
const romiCell = (m: Metric<number>) => (m.value === null ? <Missing reason={m.reason} /> : romiText(m.value));

export default async function BudgetSummaryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const me = await requireFeature('/marketing/budget');
  const copy = verticalCopy(me.context?.vertical);
  const loaded = await loadBudget(await searchParams);
  const subtitle = 'Сколько потратили на продвижение, сколько пришло заявок и окупается ли каждый канал.';
  if (loaded.chooseLocation || loaded.error)
    return (
      <Page crumbs={<BackToModules />} title={BUDGET_TITLE} subtitle={subtitle}>
        {loaded.error ? <LoadError testId="budget-error" {...loaded.error} /> : <ChooseLocation />}
      </Page>
    );
  const view = loaded.view!;
  const [campaigns, results] = await Promise.all([
    quiet(marketingCampaignsApi.list(view.month)).then((r): MarketingCampaignView[] | 'error' =>
      r === 'error' ? r : r.campaigns,
    ),
    quiet<MarketingResultsView>(marketingBudgetApi.results(view.month)),
  ]);
  const s = budgetSummary({ view, campaigns, results });
  const rc = view.reportingCurrency;
  const cabinet = s.cabinetSpend;

  return (
    <Page crumbs={<BackToModules />} title={BUDGET_TITLE} subtitle={subtitle}>
      <div className="budget-screen" data-testid="budget-summary">
        <div className="budget-head">
          <BudgetTabs current="summary" month={view.month} />
          <MonthNav base="/marketing/budget" month={view.month} />
        </div>
        <Stats min={180} className="budget-summary-stats">
          <Stat
            label="Расход вручную"
            value={formatMoney(s.manualSpend.value, rc)}
            hint="Журнал расходов, учтённые в бюджете"
            testId="summary-manual"
          />
          <Stat
            label="Расход кабинета Meta"
            value={
              cabinet.value === null ? NO_DATA : cabinet.value.length === 0 ? 'Не подключён' : cabinetText(cabinet.value)
            }
            size={cabinet.value === null || cabinet.value.length === 0 ? 'sm' : undefined}
            hint={
              cabinet.value === null
                ? cabinet.reason
                : cabinet.value.length === 0
                  ? 'Подключите кабинет в «Рекламе»'
                  : 'По данным кабинета, в его валюте'
            }
            testId="summary-cabinet"
          />
          <Stat
            label={copy.requests}
            value={s.requests.value === null ? NO_DATA : String(s.requests.value)}
            size={s.requests.value === null ? 'sm' : undefined}
            hint={s.requests.reason ?? 'Обращения из своих каналов'}
            testId="summary-requests"
          />
          <Stat
            label="Цена заявки"
            value={s.costPerRequest.value === null ? NO_DATA : formatMoney(s.costPerRequest.value, rc)}
            size={s.costPerRequest.value === null ? 'sm' : undefined}
            hint={s.costPerRequest.reason ?? 'Расход вручную на одну заявку'}
            testId="summary-cpr"
          />
          <Stat
            label="ROMI"
            value={s.romi.value === null ? NO_DATA : romiText(s.romi.value)}
            size={s.romi.value === null ? 'sm' : undefined}
            tone={s.romi.value !== null && s.romi.value < 0 ? 'danger' : undefined}
            hint={s.romi.reason ?? '(выручка − расход) / расход'}
            testId="summary-romi"
          />
        </Stats>
        <p className="settings-note" data-testid="summary-separate-note">
          Расход вручную и расход кабинета Meta показаны отдельно и не складываются: оплата счёта Meta, записанная в
          журнал, это те же деньги, что у кабинета.
        </p>

        <section aria-labelledby="summary-channels-title">
          <SectionTitle id="summary-channels-title">По каналам</SectionTitle>
          {s.channels.length === 0 ? (
            <p className="settings-note" data-testid="summary-channels-empty">
              В этом месяце нет ни расходов, ни заявок из каналов продвижения. Добавьте расход во вкладке «Расходы»,
              заявки подтянутся сами.
            </p>
          ) : (
            <div className="tbl-wrap" role="region" aria-label="Сводка по каналам" tabIndex={0}>
              <Table density="normal" aria-label="Сводка по каналам" data-testid="summary-channels">
                <thead>
                  <tr>
                    <th scope="col">Канал</th>
                    <th scope="col" className="budget-td-num">
                      Расход вручную
                    </th>
                    <th scope="col" className="budget-td-num">
                      Расход кабинета
                    </th>
                    <th scope="col" className="budget-td-num">
                      Заявки
                    </th>
                    <th scope="col" className="budget-td-num">
                      Цена заявки
                    </th>
                    <th scope="col" className="budget-td-num">
                      Выручка
                    </th>
                    <th scope="col" className="budget-td-num">
                      ROMI
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {s.channels.map((c) => (
                    <tr key={c.platform} data-testid={`summary-row-${c.platform}`}>
                      <td>
                        <span className="budget-cell-main">{platformLabel(c.platform)}</span>
                        {c.cabinet.length > 0 && (
                          <span className="budget-cell-sub">
                            <Badge tone="info">Кабинет</Badge>
                          </span>
                        )}
                      </td>
                      <td className="budget-td-num">{formatMoney(c.manualSpendMinor, rc)}</td>
                      <td className="budget-td-num">{c.cabinet.length > 0 ? cabinetText(c.cabinet) : '–'}</td>
                      <td className="budget-td-num">
                        {c.requests.value === null ? (
                          <Missing reason={c.requests.reason} />
                        ) : (
                          <>
                            {c.requests.value}
                            {c.requests.platform && <span className="budget-cell-sub">лиды площадки</span>}
                          </>
                        )}
                      </td>
                      <td className="budget-td-num">{moneyCell(c.costPerRequest)}</td>
                      <td className="budget-td-num">{moneyCell(c.revenue)}</td>
                      <td className="budget-td-num">{romiCell(c.romi)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr data-testid="summary-total">
                    <td>
                      <strong>Итого</strong>
                    </td>
                    <td className="budget-td-num">{formatMoney(s.manualSpend.value, rc)}</td>
                    <td className="budget-td-num">
                      {cabinet.value && cabinet.value.length > 0 ? cabinetText(cabinet.value) : '–'}
                    </td>
                    <td className="budget-td-num">
                      {s.requests.value === null ? <Missing reason={s.requests.reason} /> : s.requests.value}
                    </td>
                    <td className="budget-td-num">{moneyCell(s.costPerRequest)}</td>
                    <td className="budget-td-num">{moneyCell(s.revenue)}</td>
                    <td className="budget-td-num">{romiCell(s.romi)}</td>
                  </tr>
                </tfoot>
              </Table>
            </div>
          )}
          <p className="settings-note" data-testid="summary-channels-note">
            Заявки и выручка канала: брони и обращения из сайта, WhatsApp, Instagram и телефона, как во вкладке
            «Аналитика». У рекламы своих броней нет: у кабинета Meta видны лиды площадки и цена лида по кабинету в его
            валюте, ROMI появится, когда брони начнут нести метку кампании. Разные валюты не складываются.
          </p>
        </section>
      </div>
    </Page>
  );
}
