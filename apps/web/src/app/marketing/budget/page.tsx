import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { can } from '@pms/domain';
import type { SearchParams } from '../../../lib/search-params';
import { requireFeature } from '../../../lib/vertical-guard';
import { formatMoney } from '../../../lib/money';
import { METRIC } from '../../../lib/metric-words';
import { deskShell } from '../../../lib/desk-shell';
import { verticalCopy } from '../../../lib/vertical-copy';
import {
  marketingBudgetApi,
  marketingCampaignsApi,
  metaConnectionApi,
  type MarketingCampaignView,
  type MetaConnectionView,
  type MarketingResultsView,
} from '../../../lib/api';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { Badge, SectionTitle, Table } from '../../../components/ui';
import { BackToModules } from '../parts';
import '../marketing.css';
import './budget.css';
import '../../finance/summary.css';
import { loadBudget } from './load';
import { BUDGET_TITLE, BudgetTabs, ChooseLocation, MonthNav, platformLabel } from './parts';
import { budgetSummary, type CabinetSum, type Metric, type MoneyMetric } from './summary';
import { dataSources, type DataSource, type SourceState } from './sources';
import { ExpenseButton, ImportCsvButton, type ExpenseDefaults } from './drawers';
import { ConnectButton } from '../ads/meta';
import { msg, type Translate } from '../../../i18n';
import { currentLocale, serverT } from '../../../i18n/server';

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

const romiText = (v: number) => `${v > 0 ? '+' : ''}${v} %`;
const cabinetText = (sums: CabinetSum[]) => sums.map((s) => formatMoney(s.amountMinor, s.currency)).join(', ');

/** Ячейка с пропуском: «нет данных» и причина для программы чтения и подсказкой при наведении */
function Missing({ reason, t }: { reason: string | null; t: Translate }) {
  return (
    <span className="budget-cell-missing" title={reason ?? undefined}>
      {t('Нет данных')}
      {reason && <span className="sr-only">: {reason}</span>}
    </span>
  );
}

const moneyCell = (m: MoneyMetric, t: Translate) =>
  m.value === null ? <Missing reason={m.reason} t={t} /> : formatMoney(m.value, m.currency);
const romiCell = (m: Metric<number>, t: Translate) =>
  m.value === null ? <Missing reason={m.reason} t={t} /> : romiText(m.value);

export default async function BudgetSummaryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const me = await requireFeature('/marketing/budget');
  const [t, locale] = await Promise.all([serverT(), currentLocale()]);
  const copy = verticalCopy(me.context?.vertical);
  const [loaded, shell] = await Promise.all([loadBudget(await searchParams), deskShell()]);
  const role = shell.access.role;
  const editable = !shell.readOnly && (role === null || can(role, 'marketing'));
  const subtitle = t('Сколько потратили на продвижение, сколько пришло заявок и окупается ли каждый канал.');
  if (loaded.chooseLocation || loaded.error)
    return (
      <Page crumbs={<BackToModules />} title={t(BUDGET_TITLE)} subtitle={subtitle}>
        {loaded.error ? <LoadError testId="budget-error" {...loaded.error} /> : <ChooseLocation />}
      </Page>
    );
  const view = loaded.view!;
  const [campaignsView, results, meta] = await Promise.all([
    quiet(marketingCampaignsApi.list(view.month)),
    quiet<MarketingResultsView>(marketingBudgetApi.results(view.month)),
    quiet<MetaConnectionView>(metaConnectionApi.view()),
  ]);
  const campaigns: MarketingCampaignView[] | 'error' = campaignsView === 'error' ? 'error' : campaignsView.campaigns;
  const s = budgetSummary({ view, campaigns, results, t });
  const rc = view.reportingCurrency;
  const cabinet = s.cabinetSpend;
  const sources = dataSources({
    expenses: view.expenses.length,
    otherAds: [...new Set(view.expenses.map((e) => e.platform))].filter((p) =>
      ['GOOGLE', 'TIKTOK', 'YOUTUBE'].includes(p),
    ),
    meta,
    results,
    editable,
    locale,
    t,
  });
  const defaults: ExpenseDefaults = {
    today: view.today,
    reportingCurrency: rc,
    locationCurrency: view.locationCurrency,
    campaigns: campaigns === 'error' ? [] : campaigns,
  };

  return (
    <Page crumbs={<BackToModules />} title={t(BUDGET_TITLE)} subtitle={subtitle}>
      <div className="budget-screen" data-testid="budget-summary">
        <div className="budget-head">
          <BudgetTabs current="summary" month={view.month} />
          <MonthNav base="/marketing/budget" month={view.month} />
        </div>
        {/* итоги месяца одной строкой, без плиток (аудит 21.10.2026 п. 32, как «План» и «Аналитика») */}
        <dl className="money-summary" data-testid="summary-line">
          <div>
            <dt>{t('Расход вручную')}</dt>
            <dd data-testid="summary-manual">{formatMoney(s.manualSpend.value, rc)}</dd>
          </div>
          <div>
            <dt>{t('Расход кабинета Meta')}</dt>
            <dd data-testid="summary-cabinet">
              {cabinet.value === null ? (
                <Missing reason={cabinet.reason} t={t} />
              ) : cabinet.value.length === 0 ? (
                <span className="muted">{t('не подключён')}</span>
              ) : (
                cabinetText(cabinet.value)
              )}
            </dd>
          </div>
          <div>
            <dt>{t(copy.requests)}</dt>
            <dd data-testid="summary-requests">
              {s.requests.value === null ? <Missing reason={s.requests.reason} t={t} /> : String(s.requests.value)}
            </dd>
          </div>
          <div>
            <dt>{t(METRIC.cpl)}</dt>
            <dd data-testid="summary-cpr">
              {s.costPerRequest.value === null ? (
                <Missing reason={s.costPerRequest.reason} t={t} />
              ) : (
                formatMoney(s.costPerRequest.value, rc)
              )}
            </dd>
          </div>
          <div>
            <dt>{t(METRIC.romi)}</dt>
            <dd
              data-testid="summary-romi"
              className={s.romi.value !== null && s.romi.value < 0 ? 'budget-td-danger' : undefined}
            >
              {s.romi.value === null ? <Missing reason={s.romi.reason} t={t} /> : romiText(s.romi.value)}
            </dd>
          </div>
        </dl>
        <Sources sources={sources} month={view.month} defaults={defaults} reportingCurrency={rc} t={t} />
        <p className="settings-note" data-testid="summary-separate-note">
          {t(
            'Расход вручную и расход кабинета Meta показаны отдельно и не складываются: оплата счёта Meta, записанная в журнал, это те же деньги, что у кабинета.',
          )}
        </p>

        <section aria-labelledby="summary-channels-title">
          <SectionTitle id="summary-channels-title">{t('По каналам')}</SectionTitle>
          {s.channels.length === 0 ? (
            <p className="settings-note" data-testid="summary-channels-empty">
              {t(
                'В этом месяце нет ни расходов, ни заявок из каналов продвижения. Добавьте расход во вкладке «Расходы», заявки подтянутся сами.',
              )}
            </p>
          ) : (
            <div className="tbl-wrap" role="region" aria-label={t('Сводка по каналам')} tabIndex={0}>
              <Table density="normal" aria-label={t('Сводка по каналам')} data-testid="summary-channels">
                <thead>
                  <tr>
                    <th scope="col">{t('Канал')}</th>
                    <th scope="col" className="budget-td-num">
                      {t('Расход вручную')}
                    </th>
                    <th scope="col" className="budget-td-num">
                      {t('Расход кабинета')}
                    </th>
                    <th scope="col" className="budget-td-num">
                      {t('Заявки')}
                    </th>
                    <th scope="col" className="budget-td-num">
                      {t(METRIC.cpl)}
                    </th>
                    <th scope="col" className="budget-td-num">
                      {t('Выручка')}
                    </th>
                    <th scope="col" className="budget-td-num">
                      {t(METRIC.romi)}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {s.channels.map((c) => (
                    <tr key={c.platform} data-testid={`summary-row-${c.platform}`}>
                      <td>
                        <span className="budget-cell-main">{t(platformLabel(c.platform))}</span>
                        {c.cabinet.length > 0 && (
                          <span className="budget-cell-sub">
                            <Badge tone="info">{t('Кабинет')}</Badge>
                          </span>
                        )}
                      </td>
                      <td className="budget-td-num">{formatMoney(c.manualSpendMinor, rc)}</td>
                      <td className="budget-td-num">{c.cabinet.length > 0 ? cabinetText(c.cabinet) : '–'}</td>
                      <td className="budget-td-num">
                        {c.requests.value === null ? (
                          <Missing reason={c.requests.reason} t={t} />
                        ) : (
                          <>
                            {c.requests.value}
                            {c.requests.platform && <span className="budget-cell-sub">{t('лиды площадки')}</span>}
                          </>
                        )}
                      </td>
                      <td className="budget-td-num">{moneyCell(c.costPerRequest, t)}</td>
                      <td className="budget-td-num">{moneyCell(c.revenue, t)}</td>
                      <td className="budget-td-num">{romiCell(c.romi, t)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr data-testid="summary-total">
                    <td>
                      <strong>{t('Итого')}</strong>
                    </td>
                    <td className="budget-td-num">{formatMoney(s.manualSpend.value, rc)}</td>
                    <td className="budget-td-num">
                      {cabinet.value && cabinet.value.length > 0 ? cabinetText(cabinet.value) : '–'}
                    </td>
                    <td className="budget-td-num">
                      {s.requests.value === null ? <Missing reason={s.requests.reason} t={t} /> : s.requests.value}
                    </td>
                    <td className="budget-td-num">{moneyCell(s.costPerRequest, t)}</td>
                    <td className="budget-td-num">{moneyCell(s.revenue, t)}</td>
                    <td className="budget-td-num">{romiCell(s.romi, t)}</td>
                  </tr>
                </tfoot>
              </Table>
            </div>
          )}
          <p className="settings-note" data-testid="summary-channels-note">
            {t(
              'Заявки и выручка канала: брони и обращения из сайта, WhatsApp, Instagram и телефона, как во вкладке «Аналитика». У рекламы своих броней нет: у кабинета Meta видны лиды площадки и цена лида по кабинету в его валюте, окупаемость рекламы появится, когда брони начнут нести метку кампании. Разные валюты не складываются.',
            )}
          </p>
        </section>
      </div>
    </Page>
  );
}

const STATE: Record<SourceState, { tone: 'ok' | 'warn' | 'danger' | 'neutral' | 'info'; label: string }> = {
  ok: { tone: 'ok', label: msg('Работает') },
  todo: { tone: 'warn', label: msg('Нужно добавить') },
  error: { tone: 'danger', label: msg('Ошибка') },
  off: { tone: 'neutral', label: msg('Недоступно') },
  manual: { tone: 'info', label: msg('Вручную') },
};

/**
 * «Откуда берутся цифры»: каждый источник сводки строкой: что он даёт, состояние и кнопка, которая его включает
 * (добавить расход, загрузить CSV, подключить кабинет Meta). Владелец видит, что сделать, не уходя со сводки.
 */
function Sources({
  sources,
  month,
  defaults,
  reportingCurrency,
  t,
}: {
  sources: DataSource[];
  month: string;
  defaults: ExpenseDefaults;
  reportingCurrency: string;
  t: Translate;
}) {
  return (
    <section aria-labelledby="summary-sources-title" data-testid="summary-sources">
      <SectionTitle id="summary-sources-title">{t('Откуда берутся цифры')}</SectionTitle>
      <ul className="budget-sources">
        {sources.map((src) => (
          <li key={src.key} className="panel budget-sources__row" data-testid={`source-${src.key}`}>
            <div className="budget-sources__head">
              <h3 className="budget-sources__title">{src.title}</h3>
              <Badge tone={STATE[src.state].tone} data-testid={`source-${src.key}-state`}>
                {t(STATE[src.state].label)}
              </Badge>
            </div>
            <p className="budget-sources__status" data-testid={`source-${src.key}-status`}>
              {src.status}
            </p>
            <p className="budget-sources__text">{src.text}</p>
            {src.actions.length > 0 && (
              <div className="budget-sources__actions">
                {src.actions.map((a) =>
                  a === 'add-expense' ? (
                    <ExpenseButton key={a} primary={src.state === 'todo'} defaults={defaults} />
                  ) : a === 'import-csv' ? (
                    <ImportCsvButton key={a} reportingCurrency={reportingCurrency} />
                  ) : a === 'connect-meta' ? (
                    <ConnectButton key={a} again={src.state === 'error'} />
                  ) : (
                    <Link
                      key={a}
                      className="btn btn--ghost btn--sm"
                      href={
                        a === 'journal'
                          ? `/marketing/budget/expenses?month=${month}`
                          : a === 'open-ads'
                            ? '/marketing/ads'
                            : `/marketing/analytics?month=${month}`
                      }
                    >
                      {a === 'journal' ? t('Журнал расходов') : a === 'open-ads' ? t('Открыть «Рекламу»') : t('Открыть аналитику')}
                    </Link>
                  ),
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
