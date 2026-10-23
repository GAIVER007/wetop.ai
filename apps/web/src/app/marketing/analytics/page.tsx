import { unstable_rethrow } from 'next/navigation';
import type { SearchParams } from '../../../lib/search-params';
import { requireFeature } from '../../../lib/vertical-guard';
import { marketingBudgetApi, type MarketingResultsView } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { deltaPercent } from '../../../lib/dashboard-format';
import { verticalCopy } from '../../../lib/vertical-copy';
import type { WebVertical } from '../../../lib/vertical-landing';
import { pluralRu } from '../../../lib/plural';
import { displayDate } from '../../../lib/display-date';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { ShareBar } from '../../../components/share-bar';
import { Badge, EmptyState, SectionTitle, Table } from '../../../components/ui';
import { BackToModules } from '../parts';
import '../marketing.css';
import '../budget/budget.css';
import '../../finance/summary.css';
import { loadBudget } from '../budget/load';
import { byDay, summarize } from '../budget/derive';
import { DailyChart } from '../budget/chart';
import { BudgetTabs, ChooseLocation, MonthNav, platformLabel } from '../budget/parts';
import { buildAnalyticsReport } from './report';
import { METRIC } from '../../../lib/metric-words';

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

/** Слова результата по направлению (аудит 21.10.2026 п. 16): у салона записи, у ресторана брони столов */
const RESULT_WORDS: Record<WebVertical, { many: string; one: string; forms: [string, string, string]; share: string }> = {
  HOSPITALITY: { many: 'Брони', one: 'брони', forms: ['бронь', 'брони', 'броней'], share: 'бронью' },
  BEAUTY: { many: 'Записи', one: 'записи', forms: ['запись', 'записи', 'записей'], share: 'записью' },
  FOOD_SERVICE: { many: 'Брони столов', one: 'брони стола', forms: ['бронь', 'брони', 'броней'], share: 'бронью' },
};

export default async function MarketingAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const me = await requireFeature('/marketing/analytics');
  const vertical: WebVertical = me.context?.vertical ?? 'HOSPITALITY';
  const hotel = vertical === 'HOSPITALITY';
  const copy = verticalCopy(vertical);
  const w = RESULT_WORDS[vertical];
  const loaded = await loadBudget(await searchParams);
  const subtitle = `Куда уходят деньги и что они приносят: от расходов до ${w.forms[2]} и выручки.`;
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
  const report = buildAnalyticsReport(view, results);
  const { ok, funnel, calendar, revenueCurrency } = report;
  const total = funnel.total;
  const conversion =
    total.leads > 0 ? Math.round((total.bookings * 100) / total.leads) : null;
  // пустой месяц: одно пустое состояние вместо 31 строки нулей (аудит п. 33)
  const emptyMonth = t.spent === 0n && funnel.rows.length === 0 && (!ok || (total.leads === 0 && total.bookings === 0));

  return (
    <Page crumbs={<BackToModules />} title="Аналитика маркетинга" subtitle={subtitle}>
      <div className="budget-screen" data-testid="marketing-analytics">
        <div className="budget-head">
          {/* вкладки раздела, как у «Бюджета» (аудит 21.10.2026 п. 6) */}
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
        {/* итоги месяца одной строкой вместо восьми плиток (аудит п. 33) */}
        <dl className="money-summary" data-testid="man-summary">
          <div>
            <dt>Расходы на рекламу</dt>
            <dd data-testid="man-spent">{formatMoney(t.spent, rc)}</dd>
            {prev > 0n && (
              <dd className="muted">
                {deltaPercent(t.spent, prev).text} к прошлому месяцу
              </dd>
            )}
          </div>
          <div>
            <dt>Обращения</dt>
            <dd data-testid="man-leads">{ok ? String(total.leads) : dash}</dd>
          </div>
          {ok && (
            <div>
              <dt>Квалифицированные</dt>
              <dd className="muted">Недостаточно данных</dd>
            </div>
          )}
          <div>
            <dt>{w.many}</dt>
            <dd data-testid="man-bookings">{ok ? String(total.bookings) : dash}</dd>
            {conversion !== null && <dd className="muted">{conversion} % обращений</dd>}
          </div>
          <div>
            <dt>Выручка</dt>
            <dd data-testid="man-revenue">{ok ? formatMoney(total.revenueMinor, revenueCurrency) : dash}</dd>
          </div>
          <div>
            <dt>{METRIC.cpl}</dt>
            <dd data-testid="man-cpl">{money(total.cplMinor, rc)}</dd>
          </div>
          <div>
            <dt>Стоимость {w.one}</dt>
            <dd data-testid="man-cpb">{money(total.costPerBookingMinor, rc)}</dd>
          </div>
          <div>
            <dt>{METRIC.romi}</dt>
            <dd data-testid="man-romi">{!ok ? dash : funnel.romiAvailable ? romiText(total.romiPct) : 'Разные валюты'}</dd>
          </div>
        </dl>

        {results === 'error' && (
          <p className="settings-note" role="alert" data-testid="man-results-error">
            Результаты каналов не загрузились: показываем только расходы. Обновите страницу.
          </p>
        )}
        {results !== 'error' && !results.supported && (
          <p className="marketing-soon" data-testid="man-results-soon">
            <Badge tone="info">Скоро</Badge>
            <span>
              Обращения и выручка по каналам для салона и ресторана появятся позже. Пока здесь расходы из
              «Бюджета».
            </span>
          </p>
        )}

        {emptyMonth ? (
          <EmptyState title="В этом месяце пока пусто" data-testid="man-empty">
            Добавьте расходы на рекламу в «Бюджете»: здесь появятся каналы, дни и окупаемость.
          </EmptyState>
        ) : (
        <>
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
                <span className="man-funnel__name">{w.many}</span>
                <span className="man-funnel__value">
                  {pluralRu(total.bookings, w.forms)}
                </span>
                {conversion !== null && (
                  <ShareBar label={`Доля обращений, ставших ${w.share}`} value={conversion} showValue />
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
              В этом месяце нет ни расходов, ни {w.forms[2]} из маркетинговых каналов. Добавьте расходы в
              «Бюджете», {w.many.toLowerCase()} подтянутся сами.
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
                      {METRIC.cpl}
                    </th>
                    <th scope="col" className="budget-td-num">
                      {w.many}
                    </th>
                    <th scope="col" className="budget-td-num">
                      Стоимость {w.one}
                    </th>
                    <th scope="col" className="budget-td-num">
                      Выручка
                    </th>
                    <th scope="col" className="budget-td-num">
                      {METRIC.romi}
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
            {hotel
              ? 'Канал брони это её источник: сайт, WhatsApp, Instagram, телефон. Обращения: заявки с сайта, диалоги ИИ-продавца, дошедшие до цены, и брони без ИИ-продавца. Отменённые брони и незаезды в брони и выручку не входят, OTA и стойка в маркетинг не входят. '
              : `Канал это источник обращения: сайт, WhatsApp, Instagram, телефон. Отменённые ${w.forms[2]} в выручку не входят. `}
            Реклама в Meta, Google и TikTok пока показывает только расход: связать её с {hotel ? 'бронями' : 'продажами'} можно
            будет после подключения кабинетов.
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
                      {METRIC.cpl}
                    </th>
                    <th scope="col" className="budget-td-num">
                      {w.many}
                    </th>
                    <th scope="col" className="budget-td-num">
                      Новые клиенты
                    </th>
                    <th scope="col" className="budget-td-num">
                      Выручка
                    </th>
                    <th scope="col" className="budget-td-num">
                      {METRIC.romi}
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
            {hotel ? ' бронь и выручка в день, когда бронь сделали.' : ` ${w.forms[0]} и выручка в день, когда ${w.forms[0]} сделали.`}{' '}
            Новые клиенты: {w.forms[2]} {copy.clientsOf}, у которых раньше их не было. Окупаемость одного дня шумная, потому что
            реклама окупается не в тот же день; смотрите итог месяца.
          </p>
        </section>

        <section aria-labelledby="man-days-title">
          <SectionTitle id="man-days-title">Расходы по дням</SectionTitle>
          <div className="panel panel--lg">
            <DailyChart days={byDay(view.expenses, view.month)} month={view.month} currency={rc} />
          </div>
        </section>
        </>
        )}
      </div>
    </Page>
  );
}
