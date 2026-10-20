import { unstable_rethrow } from 'next/navigation';
import type { SearchParams } from '../../../lib/search-params';
import { requireFeature } from '../../../lib/vertical-guard';
import { marketingBudgetApi, type MarketingResultsView } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { deltaPercent } from '../../../lib/dashboard-format';
import { pluralRu } from '../../../lib/plural';
import { displayDate } from '../../../lib/display-date';
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
import { BUDGET_TITLE, BudgetTabs, ChooseLocation, MonthNav, platformLabel } from '../budget/parts';
import { buildAnalyticsReport } from './report';

/**
 * «Бюджет и аналитика → Аналитика» (с 20.10.2026 вкладка раздела; МКТ-В5a, ADR-MKT-B5a, Q-MKT-ATTR): воронка «Расходы → Обращения → Брони → Выручка»
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
  await requireFeature('/marketing/analytics');
  const loaded = await loadBudget(await searchParams);
  const subtitle = 'Куда уходят деньги и что они приносят: от расходов до броней и выручки.';
  if (loaded.chooseLocation || loaded.error)
    return (
      <Page crumbs={<BackToModules />} title={BUDGET_TITLE} subtitle={subtitle}>
        {loaded.error ? <LoadError testId="man-error" {...loaded.error} /> : <ChooseLocation />}
      </Page>
    );
  const view = loaded.view!;
  const rc = view.reportingCurrency;
  const t = summarize(view);
  const prev = BigInt(view.prevSpent);
  const results = await loadResults(view.month);
  const report = buildAnalyticsReport(view, results);
  const { ok, funnel, calendar, revenueCurrency } = report;
  const total = funnel.total;
  const conversion =
    total.leads > 0 ? Math.round((total.bookings * 100) / total.leads) : null;

  return (
    <Page crumbs={<BackToModules />} title={BUDGET_TITLE} subtitle={subtitle}>
      <div className="budget-screen" data-testid="marketing-analytics">
        <div className="budget-head">
          <BudgetTabs current="analytics" month={view.month} />
          <div className="budget-month">
            <MonthNav base="/marketing/analytics" month={view.month} />
            {/* файл собирает тот же расчёт, что экран (report.ts); обычная ссылка, без JS */}
            <a
              className="btn btn--secondary btn--sm"
              href={`/marketing/analytics/export?month=${view.month}`}
              download
              data-testid="man-export"
            >
              Выгрузить CSV
            </a>
          </div>
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
            value={!ok ? dash : funnel.romiAvailable ? romiText(total.romiPct) : 'Разные валюты'}
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

        <section aria-labelledby="man-calendar-title">
          <SectionTitle id="man-calendar-title">Календарь маркетинга</SectionTitle>
          {calendar.rows.length === 0 ? (
            <p className="settings-note" data-testid="man-calendar-empty">
              Месяц ещё не начался: дни появятся по мере того, как он идёт.
            </p>
          ) : (
            <div className="tbl-wrap" role="region" aria-label="Календарь маркетинга по дням" tabIndex={0}>
              <Table density="compact" aria-label="Календарь маркетинга по дням" data-testid="man-calendar">
                <thead>
                  <tr>
                    <th scope="col">День</th>
                    <th scope="col" className="budget-td-num">
                      Расход
                    </th>
                    <th scope="col" className="budget-td-num">
                      Лиды
                    </th>
                    <th scope="col" className="budget-td-num">
                      CPL
                    </th>
                    <th scope="col" className="budget-td-num">
                      Брони
                    </th>
                    <th scope="col" className="budget-td-num">
                      Новые клиенты
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
                  {calendar.rows.map((d) => (
                    <tr key={d.date} data-testid={`man-day-${d.date}`}>
                      <td>
                        <time dateTime={d.date}>{displayDate(d.date)}</time>
                      </td>
                      <td className="budget-td-num">{formatMoney(d.spendMinor, rc)}</td>
                      <td className="budget-td-num">{ok ? d.leads : dash}</td>
                      <td className="budget-td-num">{money(d.cplMinor, rc)}</td>
                      <td className="budget-td-num">{ok ? d.bookings : dash}</td>
                      <td className="budget-td-num">{ok ? d.newGuests : dash}</td>
                      <td className="budget-td-num">
                        {ok ? formatMoney(d.revenueMinor, revenueCurrency) : dash}
                      </td>
                      <td className="budget-td-num">{romiText(d.romiPct)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr data-testid="man-calendar-total">
                    <td>
                      <strong>Итого</strong>
                    </td>
                    <td className="budget-td-num">{formatMoney(calendar.total.spendMinor, rc)}</td>
                    <td className="budget-td-num">{ok ? calendar.total.leads : dash}</td>
                    <td className="budget-td-num">{money(calendar.total.cplMinor, rc)}</td>
                    <td className="budget-td-num">{ok ? calendar.total.bookings : dash}</td>
                    <td className="budget-td-num">{ok ? calendar.total.newGuests : dash}</td>
                    <td className="budget-td-num">
                      {ok ? formatMoney(calendar.total.revenueMinor, revenueCurrency) : dash}
                    </td>
                    <td className="budget-td-num">{romiText(calendar.total.romiPct)}</td>
                  </tr>
                </tfoot>
              </Table>
            </div>
          )}
          <p className="settings-note" data-testid="man-calendar-note">
            По дням: расход в день оплаты, обращение в день заявки или первого предложения ИИ-продавца,
            бронь и выручка в день, когда бронь сделали. Новые клиенты: брони гостей, у которых раньше не
            было броней у объекта. ROMI одного дня шумный, потому что реклама окупается не в тот же день;
            смотрите итог месяца.
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
