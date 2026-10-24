import { unstable_rethrow } from 'next/navigation';
import type { SearchParams } from '../../../lib/search-params';
import { requireFeature } from '../../../lib/vertical-guard';
import { marketingBudgetApi, type MarketingResultsView } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { deltaPercent } from '../../../lib/dashboard-format';
import type { WebVertical } from '../../../lib/vertical-landing';
import { countLabel, intlLocale, msg } from '../../../i18n';
import { currentLocale, serverT } from '../../../i18n/server';
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
import { BUDGET_TITLE, BudgetTabs, ChooseLocation, MonthNav, platformLabel } from '../budget/parts';
import { buildAnalyticsReport } from './report';
import { METRIC } from '../../../lib/metric-words';

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

/**
 * Слова результата по направлению (аудит 21.10.2026 п. 16): у салона записи, у ресторана брони столов. Фразы целиком
 * (KK3): русские падежи из verticalCopy не подставляются в перевод.
 */
interface ResultWords {
  many: string;
  cost: string;
  forms: [string, string, string];
  subtitle: string;
  share: string;
  sourcesEmpty: string;
  sourcesNote: string;
  adsNote: string;
  calendarNote: string;
}
const RESULT_WORDS: Record<WebVertical, ResultWords> = {
  HOSPITALITY: {
    many: msg('Брони'),
    cost: msg('Стоимость брони'),
    forms: [msg('бронь'), 'брони', msg('броней')], // kk-allow: форма склонения
    subtitle: msg('Куда уходят деньги и что они приносят: от расходов до броней и выручки.'),
    share: msg('Доля обращений, ставших бронью'),
    sourcesEmpty: msg('В этом месяце нет ни расходов, ни броней из маркетинговых каналов. Добавьте расходы в «Бюджете», брони подтянутся сами.'),
    sourcesNote: msg(
      'Канал брони это её источник: сайт, WhatsApp, Instagram, телефон. Обращения: заявки с сайта, диалоги ИИ-продавца, дошедшие до цены, и брони без ИИ-продавца. Отменённые брони и незаезды в брони и выручку не входят, OTA и стойка в маркетинг не входят.',
    ),
    adsNote: msg('Реклама в Meta, Google и TikTok пока показывает только расход: связать её с бронями можно будет после подключения кабинетов.'),
    calendarNote: msg(
      'По дням: расход в день оплаты, обращение в день заявки или первого предложения ИИ-продавца, бронь и выручка в день, когда бронь сделали. Новые клиенты: брони гостей, у которых раньше броней не было. Окупаемость одного дня шумная, потому что реклама окупается не в тот же день; смотрите итог месяца.',
    ),
  },
  BEAUTY: {
    many: msg('Записи'),
    cost: msg('Стоимость записи'),
    forms: [msg('запись'), 'записи', msg('записей')], // kk-allow: форма склонения
    subtitle: msg('Куда уходят деньги и что они приносят: от расходов до записей и выручки.'),
    share: msg('Доля обращений, ставших записью'),
    sourcesEmpty: msg('В этом месяце нет ни расходов, ни записей из маркетинговых каналов. Добавьте расходы в «Бюджете», записи подтянутся сами.'),
    sourcesNote: msg('Канал это источник обращения: сайт, WhatsApp, Instagram, телефон. Отменённые записи в выручку не входят.'),
    adsNote: msg('Реклама в Meta, Google и TikTok пока показывает только расход: связать её с продажами можно будет после подключения кабинетов.'),
    calendarNote: msg(
      'По дням: расход в день оплаты, обращение в день заявки или первого предложения ИИ-продавца, запись и выручка в день, когда запись сделали. Новые клиенты: записи клиентов, у которых раньше записей не было. Окупаемость одного дня шумная, потому что реклама окупается не в тот же день; смотрите итог месяца.',
    ),
  },
  FOOD_SERVICE: {
    many: msg('Брони столов'),
    cost: msg('Стоимость брони стола'),
    forms: [msg('бронь'), 'брони', msg('броней')], // kk-allow: форма склонения
    subtitle: msg('Куда уходят деньги и что они приносят: от расходов до броней и выручки.'),
    share: msg('Доля обращений, ставших бронью'),
    sourcesEmpty: msg('В этом месяце нет ни расходов, ни броней из маркетинговых каналов. Добавьте расходы в «Бюджете», брони столов подтянутся сами.'),
    sourcesNote: msg('Канал это источник обращения: сайт, WhatsApp, Instagram, телефон. Отменённые брони в выручку не входят.'),
    adsNote: msg('Реклама в Meta, Google и TikTok пока показывает только расход: связать её с продажами можно будет после подключения кабинетов.'),
    calendarNote: msg(
      'По дням: расход в день оплаты, обращение в день заявки или первого предложения ИИ-продавца, бронь и выручка в день, когда бронь сделали. Новые клиенты: брони гостей, у которых раньше броней не было. Окупаемость одного дня шумная, потому что реклама окупается не в тот же день; смотрите итог месяца.',
    ),
  },
};

export default async function MarketingAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const me = await requireFeature('/marketing/analytics');
  const vertical: WebVertical = me.context?.vertical ?? 'HOSPITALITY';
  const w = RESULT_WORDS[vertical];
  const [t, locale] = await Promise.all([serverT(), currentLocale()]);
  const loaded = await loadBudget(await searchParams);
  const subtitle = t(w.subtitle);
  if (loaded.chooseLocation || loaded.error)
    return (
      <Page crumbs={<BackToModules />} title={t(BUDGET_TITLE)} subtitle={subtitle}>
        {loaded.error ? <LoadError testId="man-error" {...loaded.error} /> : <ChooseLocation />}
      </Page>
    );
  const view = loaded.view!;
  const rc = view.reportingCurrency;
  const sum = summarize(view);
  const prev = BigInt(view.prevSpent);
  const results = await loadResults(view.month);
  const report = buildAnalyticsReport(view, results);
  const { ok, funnel, calendar, revenueCurrency } = report;
  const total = funnel.total;
  const conversion =
    total.leads > 0 ? Math.round((total.bookings * 100) / total.leads) : null;
  // пустой месяц: одно пустое состояние вместо 31 строки нулей (аудит п. 33)
  const emptyMonth = sum.spent === 0n && funnel.rows.length === 0 && (!ok || (total.leads === 0 && total.bookings === 0));

  return (
    <Page crumbs={<BackToModules />} title={t(BUDGET_TITLE)} subtitle={subtitle}>
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
              {t('Выгрузить CSV')}
            </a>
          </div>
        </div>
        {/* итоги месяца одной строкой вместо восьми плиток (аудит п. 33) */}
        <dl className="money-summary" data-testid="man-summary">
          <div>
            <dt>{t('Расходы на рекламу')}</dt>
            <dd data-testid="man-spent">{formatMoney(sum.spent, rc)}</dd>
            {prev > 0n && (
              <dd className="muted">
                {t('{delta} к прошлому месяцу', { delta: deltaPercent(sum.spent, prev).text })}
              </dd>
            )}
          </div>
          <div>
            <dt>{t('Обращения')}</dt>
            <dd data-testid="man-leads">{ok ? String(total.leads) : dash}</dd>
          </div>
          {ok && (
            <div>
              <dt>{t('Квалифицированные')}</dt>
              <dd className="muted">{t('Недостаточно данных')}</dd>
            </div>
          )}
          <div>
            <dt>{t(w.many)}</dt>
            <dd data-testid="man-bookings">{ok ? String(total.bookings) : dash}</dd>
            {conversion !== null && <dd className="muted">{t('{n} % обращений', { n: conversion })}</dd>}
          </div>
          <div>
            <dt>{t('Выручка')}</dt>
            <dd data-testid="man-revenue">{ok ? formatMoney(total.revenueMinor, revenueCurrency) : dash}</dd>
          </div>
          <div>
            <dt>{t(METRIC.cpl)}</dt>
            <dd data-testid="man-cpl">{money(total.cplMinor, rc)}</dd>
          </div>
          <div>
            <dt>{t(w.cost)}</dt>
            <dd data-testid="man-cpb">{money(total.costPerBookingMinor, rc)}</dd>
          </div>
          <div>
            <dt>{t(METRIC.romi)}</dt>
            <dd data-testid="man-romi">{!ok ? dash : funnel.romiAvailable ? romiText(total.romiPct) : t('Разные валюты')}</dd>
          </div>
        </dl>

        {results === 'error' && (
          <p className="settings-note" role="alert" data-testid="man-results-error">
            {t('Результаты каналов не загрузились: показываем только расходы. Обновите страницу.')}
          </p>
        )}
        {results !== 'error' && !results.supported && (
          <p className="marketing-soon" data-testid="man-results-soon">
            <Badge tone="info">{t('Скоро')}</Badge>
            <span>{t('Обращения и выручка по каналам для салона и ресторана появятся позже. Пока здесь расходы из «Бюджета».')}</span>
          </p>
        )}

        {emptyMonth ? (
          <EmptyState title={t('В этом месяце пока пусто')} data-testid="man-empty">
            {t('Добавьте расходы на рекламу в «Бюджете»: здесь появятся каналы, дни и окупаемость.')}
          </EmptyState>
        ) : (
        <>
        {ok && (
          <section aria-labelledby="man-funnel-title">
            <SectionTitle id="man-funnel-title">{t('Воронка маркетинга')}</SectionTitle>
            <ol className="panel panel--lg man-funnel" data-testid="man-funnel">
              <li className="man-funnel__step">
                <span className="man-funnel__name">{t('Расходы')}</span>
                <span className="man-funnel__value">{formatMoney(total.spendMinor, rc)}</span>
              </li>
              <li className="man-funnel__step">
                <span className="man-funnel__name">{t('Обращения')}</span>
                <span className="man-funnel__value">
                  {countLabel(locale, t, total.leads, [msg('обращение'), 'обращения', msg('обращений')])} {/* kk-allow: форма склонения */}
                </span>
              </li>
              <li className="man-funnel__step">
                <span className="man-funnel__name">{t(w.many)}</span>
                <span className="man-funnel__value">{countLabel(locale, t, total.bookings, w.forms)}</span>
                {conversion !== null && (
                  <ShareBar label={t(w.share)} value={conversion} showValue />
                )}
              </li>
              <li className="man-funnel__step">
                <span className="man-funnel__name">{t('Выручка')}</span>
                <span className="man-funnel__value">
                  {formatMoney(total.revenueMinor, revenueCurrency)}
                </span>
              </li>
            </ol>
          </section>
        )}

        <section aria-labelledby="man-sources-title">
          <SectionTitle id="man-sources-title">{t('Эффективность каналов')}</SectionTitle>
          {funnel.rows.length === 0 ? (
            <p className="settings-note" data-testid="man-sources-empty">
              {t(w.sourcesEmpty)}
            </p>
          ) : (
            <div className="tbl-wrap" role="region" aria-label={t('Эффективность каналов')} tabIndex={0}>
              <Table density="normal" aria-label={t('Эффективность каналов')} data-testid="man-sources">
                <thead>
                  <tr>
                    <th scope="col">{t('Канал')}</th>
                    <th scope="col" className="budget-td-num">
                      {t('Расход')}
                    </th>
                    <th scope="col" className="budget-td-num">
                      {t('Обращения')}
                    </th>
                    <th scope="col" className="budget-td-num">
                      {t(METRIC.cpl)}
                    </th>
                    <th scope="col" className="budget-td-num">
                      {t(w.many)}
                    </th>
                    <th scope="col" className="budget-td-num">
                      {t(w.cost)}
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
                  {funnel.rows.map((r) => (
                    <tr key={r.platform}>
                      <td>
                        <span className="budget-cell-main">{t(platformLabel(r.platform))}</span>
                        {!r.hasResults && (
                          <span className="budget-cell-sub">{t('ведёт на сайт и в мессенджеры')}</span>
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
                      <strong>{t('Итого')}</strong>
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
            {t(w.sourcesNote)} {t(w.adsNote)}
          </p>
        </section>

        <section aria-labelledby="man-calendar-title">
          <SectionTitle id="man-calendar-title">{t('Календарь маркетинга')}</SectionTitle>
          {calendar.rows.length === 0 ? (
            <p className="settings-note" data-testid="man-calendar-empty">
              {t('Месяц ещё не начался: дни появятся по мере того, как он идёт.')}
            </p>
          ) : (
            <div className="tbl-wrap" role="region" aria-label={t('Календарь маркетинга по дням')} tabIndex={0}>
              <Table density="compact" aria-label={t('Календарь маркетинга по дням')} data-testid="man-calendar">
                <thead>
                  <tr>
                    <th scope="col">{t('День')}</th>
                    <th scope="col" className="budget-td-num">
                      {t('Расход')}
                    </th>
                    <th scope="col" className="budget-td-num">
                      {t('Лиды')}
                    </th>
                    <th scope="col" className="budget-td-num">
                      {t(METRIC.cpl)}
                    </th>
                    <th scope="col" className="budget-td-num">
                      {t(w.many)}
                    </th>
                    <th scope="col" className="budget-td-num">
                      {t('Новые клиенты')}
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
                  {calendar.rows.map((d) => (
                    <tr key={d.date} data-testid={`man-day-${d.date}`}>
                      <td>
                        <time dateTime={d.date}>{displayDate(d.date, 'short', intlLocale(locale))}</time>
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
                      <strong>{t('Итого')}</strong>
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
            {t(w.calendarNote)}
          </p>
        </section>

        <section aria-labelledby="man-days-title">
          <SectionTitle id="man-days-title">{t('Расходы по дням')}</SectionTitle>
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
