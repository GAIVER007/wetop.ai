import { unstable_rethrow } from 'next/navigation';
import { buildMarketingFunnel, type ChannelResult } from '@pms/domain';
import type { SearchParams } from '../../../lib/search-params';
import { requireVertical } from '../../../lib/vertical-guard';
import { marketingBudgetApi, type MarketingResultsView } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { deltaPercent } from '../../../lib/dashboard-format';
import { pluralRu } from '../../../lib/plural';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { ShareBar } from '../../../components/share-bar';
import { Badge, SectionTitle, Stat, Stats, Table } from '../../../components/ui';
import { BackToModules } from '../parts';
import '../marketing.css';
import '../budget/budget.css';
import { loadBudget } from '../budget/load';
import { byDay, summarize } from '../budget/derive';
import { DailyChart } from '../budget/chart';
import { ChooseLocation, MonthNav, platformLabel } from '../budget/parts';

/**
 * «Маркетинг → Аналитика» (МКТ-В5a, ADR-MKT-B5a, Q-MKT-ATTR): воронка «Расходы → Обращения → Брони → Выручка»
 * и CPL, стоимость брони, ROMI по выручке из своих данных. Расходы из журнала «Бюджета», результаты каналов
 * из броней, ИИ-продавца и заявок сайта (`GET /marketing/results`), сборка доменной `buildMarketingFunnel`.
 * Реклама без кабинетов (Meta, Google, TikTok, YouTube) показывает только расход: связать её с бронями
 * можно будет с кабинетами (этап В3). «Квалифицированные» не имитируются: квалификацию ведёт бот у себя.
 */
async function loadResults(month: string): Promise<MarketingResultsView | 'error'> {
  try {
    return await marketingBudgetApi.results(month);
  } catch (error) {
    unstable_rethrow(error);
    return 'error';
  }
}

const dash = '–';
const money = (v: bigint | null, currency: string) => (v === null ? dash : formatMoney(v, currency));
const count = (v: number | null) => (v === null ? dash : String(v));
const romiText = (v: number | null) => (v === null ? dash : `${v > 0 ? '+' : ''}${v} %`);

export default async function MarketingAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireVertical(['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE']);
  const loaded = await loadBudget(await searchParams);
  const subtitle = 'Куда уходят деньги и что они приносят: от расходов до броней и выручки.';
  if (loaded.chooseLocation || loaded.error)
    return (
      <Page crumbs={<BackToModules />} title="Аналитика маркетинга" subtitle={subtitle}>
        {loaded.error ? <LoadError testId="man-error" {...loaded.error} /> : <ChooseLocation />}
      </Page>
    );
  const view = loaded.view!;
  const rc = view.reportingCurrency;
  const t = summarize(view);
  const prev = BigInt(view.prevSpent);
  const results = await loadResults(view.month);
  const ok = results !== 'error' && results.supported;

  const spendByPlatform: Record<string, bigint> = {};
  for (const e of view.expenses)
    if (e.countedInBudget)
      spendByPlatform[e.platform] = (spendByPlatform[e.platform] ?? 0n) + BigInt(e.baseAmount);
  const channels: ChannelResult[] = ok
    ? results.channels.map((c) => ({ ...c, revenueMinor: BigInt(c.revenue) }))
    : [];
  const funnel = buildMarketingFunnel({
    spendByPlatform,
    channels,
    reportingCurrency: rc,
    revenueCurrency: ok ? results.revenueCurrency : null,
  });
  const revenueCurrency = (ok && results.revenueCurrency) || rc;
  const total = funnel.total;
  const conversion =
    total.leads > 0 ? Math.round((total.bookings * 100) / total.leads) : null;

  return (
    <Page crumbs={<BackToModules />} title="Аналитика маркетинга" subtitle={subtitle}>
      <div className="budget-screen" data-testid="marketing-analytics">
        <div className="budget-head">
          {/* у плашки nowrap: коротко, откуда что берётся, сказано в заметке под таблицей */}
          <Badge tone="info">Данные филиала</Badge>
          <MonthNav base="/marketing/analytics" month={view.month} />
        </div>
        {/* восемь плиток: 4 + 4 на компьютере (`.man-stats`), по две на телефоне */}
        <Stats min={160} className="man-stats">
          <Stat
            label="Расходы на рекламу"
            value={formatMoney(t.spent, rc)}
            delta={prev > 0n ? deltaPercent(t.spent, prev) : undefined}
            hint={prev > 0n ? 'к прошлому месяцу' : 'прошлый месяц без расходов'}
            testId="man-spent"
          />
          <Stat label="Обращения" value={ok ? String(total.leads) : dash} testId="man-leads" />
          <Stat
            label="Квалифицированные"
            value="Недостаточно данных"
            size="sm"
            hint="Квалификацию ведёт ИИ-продавец у себя (этап В5)"
          />
          <Stat
            label="Брони"
            value={ok ? String(total.bookings) : dash}
            hint={conversion === null ? undefined : `${conversion} % обращений`}
            testId="man-bookings"
          />
          <Stat
            label="Выручка"
            value={ok ? formatMoney(total.revenueMinor, revenueCurrency) : dash}
            testId="man-revenue"
          />
          <Stat label="CPL" value={money(total.cplMinor, rc)} hint="расход на обращение" testId="man-cpl" />
          <Stat
            label="Стоимость брони"
            value={money(total.costPerBookingMinor, rc)}
            hint="расход на бронь"
            testId="man-cpb"
          />
          <Stat
            label="ROMI по выручке"
            value={funnel.romiAvailable ? romiText(total.romiPct) : 'Разные валюты'}
            hint="(выручка − расход) / расход"
            testId="man-romi"
          />
        </Stats>

        {results === 'error' && (
          <p className="settings-note" role="alert" data-testid="man-results-error">
            Результаты каналов не загрузились: показываем только расходы. Обновите страницу.
          </p>
        )}
        {results !== 'error' && !results.supported && (
          <p className="marketing-soon" data-testid="man-results-soon">
            <Badge tone="info">Скоро</Badge>
            <span>
              Обращения и выручка по каналам для салона и ресторана появятся со своими записями и
              заказами. Пока здесь расходы из «Бюджета».
            </span>
          </p>
        )}

        {ok && (
          <section aria-labelledby="man-funnel-title">
            <SectionTitle id="man-funnel-title">Воронка маркетинга</SectionTitle>
            <ol className="panel panel--lg man-funnel" data-testid="man-funnel">
              <li className="man-funnel__step">
                <span className="man-funnel__name">Расходы</span>
                <span className="man-funnel__value">{formatMoney(total.spendMinor, rc)}</span>
              </li>
              <li className="man-funnel__step">
                <span className="man-funnel__name">Обращения</span>
                <span className="man-funnel__value">
                  {pluralRu(total.leads, ['обращение', 'обращения', 'обращений'])}
                </span>
              </li>
              <li className="man-funnel__step">
                <span className="man-funnel__name">Брони</span>
                <span className="man-funnel__value">
                  {pluralRu(total.bookings, ['бронь', 'брони', 'броней'])}
                </span>
                {conversion !== null && (
                  <ShareBar label="Доля обращений, ставших бронью" value={conversion} showValue />
                )}
              </li>
              <li className="man-funnel__step">
                <span className="man-funnel__name">Выручка</span>
                <span className="man-funnel__value">
                  {formatMoney(total.revenueMinor, revenueCurrency)}
                </span>
              </li>
            </ol>
          </section>
        )}

        <section aria-labelledby="man-sources-title">
          <SectionTitle id="man-sources-title">Эффективность каналов</SectionTitle>
          {funnel.rows.length === 0 ? (
            <p className="settings-note" data-testid="man-sources-empty">
              В этом месяце нет ни расходов, ни броней из маркетинговых каналов. Добавьте расходы в
              «Бюджете», брони подтянутся сами.
            </p>
          ) : (
            <div className="tbl-wrap" role="region" aria-label="Эффективность каналов" tabIndex={0}>
              <Table density="normal" aria-label="Эффективность каналов" data-testid="man-sources">
                <thead>
                  <tr>
                    <th scope="col">Канал</th>
                    <th scope="col" className="budget-td-num">
                      Расход
                    </th>
                    <th scope="col" className="budget-td-num">
                      Обращения
                    </th>
                    <th scope="col" className="budget-td-num">
                      CPL
                    </th>
                    <th scope="col" className="budget-td-num">
                      Брони
                    </th>
                    <th scope="col" className="budget-td-num">
                      Стоимость брони
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
                  {funnel.rows.map((r) => (
                    <tr key={r.platform}>
                      <td>
                        <span className="budget-cell-main">{platformLabel(r.platform)}</span>
                        {!r.hasResults && (
                          <span className="budget-cell-sub">ведёт на сайт и в мессенджеры</span>
                        )}
                      </td>
                      <td className="budget-td-num">{formatMoney(r.spendMinor, rc)}</td>
                      <td className="budget-td-num">{count(r.leads)}</td>
                      <td className="budget-td-num">{money(r.cplMinor, rc)}</td>
                      <td className="budget-td-num">{count(r.bookings)}</td>
                      <td className="budget-td-num">{money(r.costPerBookingMinor, rc)}</td>
                      <td className="budget-td-num">{money(r.revenueMinor, revenueCurrency)}</td>
                      <td className="budget-td-num">{romiText(r.romiPct)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr data-testid="man-total">
                    <td>
                      <strong>Итого</strong>
                    </td>
                    <td className="budget-td-num">{formatMoney(total.spendMinor, rc)}</td>
                    <td className="budget-td-num">{ok ? String(total.leads) : dash}</td>
                    <td className="budget-td-num">{money(total.cplMinor, rc)}</td>
                    <td className="budget-td-num">{ok ? String(total.bookings) : dash}</td>
                    <td className="budget-td-num">{money(total.costPerBookingMinor, rc)}</td>
                    <td className="budget-td-num">
                      {ok ? formatMoney(total.revenueMinor, revenueCurrency) : dash}
                    </td>
                    <td className="budget-td-num">
                      {funnel.romiAvailable ? romiText(total.romiPct) : dash}
                    </td>
                  </tr>
                </tfoot>
              </Table>
            </div>
          )}
          <p className="settings-note" data-testid="man-sources-note">
            Канал брони это её источник: сайт, WhatsApp, Instagram, телефон. Обращения: заявки с сайта,
            диалоги ИИ-продавца, дошедшие до цены, и брони без ИИ-продавца. Отменённые брони и незаезды
            в брони и выручку не входят, OTA и стойка в маркетинг не входят. Реклама в Meta, Google и
            TikTok пока показывает только расход: связать её с бронями можно будет после подключения
            кабинетов.
          </p>
        </section>

        <section aria-labelledby="man-days-title">
          <SectionTitle id="man-days-title">Расходы по дням</SectionTitle>
          <div className="panel panel--lg">
            <DailyChart days={byDay(view.expenses, view.month)} month={view.month} currency={rc} />
          </div>
        </section>
      </div>
    </Page>
  );
}
