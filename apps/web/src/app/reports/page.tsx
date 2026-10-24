import { requireFeature } from '../../lib/vertical-guard';
import { SalonReportsScreen } from './salon-reports';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import { hotelToday, validDate } from '../../lib/hotel-api';
import { periods } from '../../lib/report-periods';
import { nightsBetween, pluralRu } from '../../lib/plural';
import { displayDate } from '../../lib/display-date';
import { dashboardApi, deskApi, financeApi } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { formatInt, formatPercent, sourceLabel } from '../../lib/dashboard-format';
import { deskShell } from '../../lib/desk-shell';
import { mayAccess } from '../../lib/navigation';
import { Page } from '../../components/page';
import { Icon } from '../../components/icon';
import { Alert, Button, Field, Grid, SectionTitle, cx } from '../../components/ui';
import { DateInput } from '../../components/date-field';
import { ReportsTabs } from './reports-tabs';
import '../directory.css';
import './reports.css';
import { msg, type Translate } from '../../i18n';
import { currentLocale, serverT } from '../../i18n/server';
import { intlLocale } from '../../i18n';

/** Тот же предел, что у отчётов API: год с запасом */
const MAX_REPORT_DAYS = 366;

/**
 * Хаб «Отчёты» (REP1, план `plans/reports-hub-2026-10-02.md`): один вход ко всем отчётам стойки.
 * Хаб ничего не считает сам — на карточке живое число из того же API, что и целевой экран, и ссылка
 * туда с тем же периодом в адресе. Отказ одного запроса гасит только свои карточки, не страницу.
 */
export default async function ReportsHubPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const me = await requireFeature('/reports');
  // Ресторан: отчёты это «Аналитика бизнеса» (закрытые заказы, оплаты по способам, блюда, официанты), а не финансы
  // (аудит вертикалей 22.10.2026 п.5); период из адреса переносится, прочие параметры нет
  if (me.context?.vertical === 'FOOD_SERVICE') {
    const { redirect } = await import('next/navigation');
    const q = normalizeSearchParams(await searchParams);
    const period = new URLSearchParams();
    if (validDate(q.from ?? '')) period.set('from', q.from!);
    if (validDate(q.to ?? '')) period.set('to', q.to!);
    redirect(`/management/analytics${period.size ? `?${period}` : ''}`);
  }
  // Отчёты салона используют собственный защищённый источник, не гостиничные итоги.
  if (me.context?.vertical === 'BEAUTY') {
    return <SalonReportsScreen searchParams={await searchParams} />;
  }
  const t = await serverT();
  const locale = await currentLocale();
  // у казахского существительное после числа не меняется: «5 күн»
  const counted = (n: number, forms: [string, string, string]) => (locale === 'kk' ? `${n} ${t(forms[0])}` : pluralRu(n, forms));
  const sp = normalizeSearchParams(await searchParams);
  const cal = periods(await hotelToday());
  const from = sp.from || cal.month.from;
  const to = sp.to || cal.month.to;
  const dates = validDate(from) && validDate(to) && from <= to;
  const days = dates ? nightsBetween(from, to) + 1 : 0;
  const tooLong = dates && days > MAX_REPORT_DAYS;
  const valid = dates && !tooLong;
  const settle = <T,>(p: Promise<T>) =>
    p.then(
      (r) => r,
      () => null,
    );
  const [fin, debts, dash, day, shell] = await Promise.all([
    valid ? settle(financeApi.report(from, to)) : null,
    valid ? settle(financeApi.debts(from, to)) : null,
    valid ? settle(dashboardApi.period(from, to)) : null,
    settle(deskApi.today()),
    deskShell(),
  ]);
  const cur = fin?.currency ?? debts?.currency ?? 'KZT';
  const withYear = from.slice(0, 4) !== to.slice(0, 4);
  const periodText =
    from === to
      ? displayDate(from, 'numeric')
      : `${displayDate(from, withYear ? 'numeric' : 'short', intlLocale(locale))} → ${displayDate(to, withYear ? 'numeric' : 'short', intlLocale(locale))}`;
  const q = `from=${from}&to=${to}`;
  const analyticsQ = `period=custom&${q}`;
  const preset = (p: { from: string; to: string }) => `/reports?from=${p.from}&to=${p.to}`;
  const isPreset = (p: { from: string; to: string }) => p.from === from && p.to === to;
  const due = debts ? BigInt(debts.balanceMinor) : 0n;
  // REP2: карточка услуг — из уже загруженной сводки, без нового запроса
  const serviceRow = fin?.chargesByKind.find((x) => x.kind === 'SERVICE');
  const d = dash?.current ?? null;
  const topSource = d && [...d.sources].sort((a, b) => b.count - a.count)[0];
  return (
    <Page
      title={t('Отчёты')}
      subtitle={
        valid ? (
          <span data-testid="reports-period">
            {periodText}, {counted(days, [msg('день'), 'дня', 'дней'])} {/* kk-allow: формы склонения для русского вида */}
          </span>
        ) : undefined
      }
    >
      <ReportsTabs current="documents" />
      <section className="reports-controls" aria-label={t('Период')}>
        <form method="get" className="reports-toolbar" data-testid="reports-period-form">
          <Field inline label={t('С')}>
            <DateInput
              key={`from-${from}`}
              name="from"
              defaultValue={from}
              aria-label={t('Период: с')}
            />
          </Field>
          <Field inline label={t('По')}>
            <DateInput
              key={`to-${to}`}
              name="to"
              rangeFromName="from"
              defaultValue={to}
              aria-label={t('Период: по')}
            />
          </Field>
          <nav className="directory-filters reports-presets" aria-label={t('Готовые периоды')}>
            {(
              [
                [msg('Сегодня'), { from: cal.today, to: cal.today }],
                [msg('7 дней'), cal.week],
                [msg('Этот месяц'), cal.month],
                [msg('Прошлый месяц'), cal.prevMonth],
              ] as const
            ).map(([label, p]) => (
              <Link
                key={label}
                href={preset(p)}
                className={isPreset(p) ? 'is-active' : ''}
                aria-current={isPreset(p) ? 'page' : undefined}
              >
                {t(label)}
              </Link>
            ))}
          </nav>
          <Button tone="secondary">{t('Показать')}</Button>
        </form>
        <p className="reports-note">
          {t('Деньги: как на «Оплатах», начисления по дате услуги, оплаты по дате операции. Загрузка и брони: как в «Аналитике», по заездам периода.')}
        </p>
      </section>

      {tooLong && (
        <Alert boxed>
          {t('Период отчёта: не больше года ({n} дней) за один запрос. Укоротите период.', { n: MAX_REPORT_DAYS })}
        </Alert>
      )}
      {!dates && (
        <Alert boxed>{t('Проверьте даты: окончание периода должно быть не раньше начала.')}</Alert>
      )}

      {valid && (
        <>
          <Group title={t('Деньги')}>
            <ReportCard
              t={t}
              href={`/finance?${q}`}
              testId="report-finance"
              title={t('Финансы за период')}
              value={fin && formatMoney(fin.chargedMinor, cur)}
              hint={t('начислено: проживание, услуги, штрафы')}
            />
            <ReportCard
              t={t}
              href={`/finance?${q}#operations`}
              testId="report-operations"
              title={t('Оплаты и возвраты')}
              value={fin && formatMoney(fin.paidMinor, cur)}
              hint={t('оплачено за период, с выгрузкой CSV')}
            />
            <ReportCard
              t={t}
              href={`/finance?${q}#services`}
              testId="report-services"
              title={t('Отчёт по услугам')}
              value={fin && formatMoney(serviceRow?.amountMinor ?? '0', cur)}
              hint={
                fin
                  ? serviceRow
                    ? t('{count} за услуги', { count: counted(serviceRow.count, [msg('начисление'), 'начисления', 'начислений']) }) // kk-allow: формы склонения для русского вида
                    : t('начислений за услуги за период нет')
                  : undefined
              }
            />
            <ReportCard
              t={t}
              href={`/finance?${q}#debts`}
              testId="report-debts"
              title={t('Долги')}
              warn={due > 0n}
              value={debts && formatMoney(debts.balanceMinor, cur)}
              hint={
                debts
                  ? debts.count > 0
                    ? t('к сбору по {count}', { count: counted(debts.count, [msg('броне'), 'броням', 'броням']) }) // kk-allow: формы склонения для русского вида
                    : t('все брони периода оплачены')
                  : undefined
              }
            />
            <ReportCard
              t={t}
              href="/reports/form-910"
              testId="report-form910"
              title={t('Доход для формы 910')}
              hint={t('по полугодиям, для бухгалтера')}
            />
          </Group>
          <Group title={t('Загрузка и продажи')}>
            <ReportCard
              t={t}
              href={`/management/analytics?${analyticsQ}`}
              testId="report-overview"
              title={t('Обзор периода')}
              value={d && formatInt(d.bookings.total)}
              hint={
                d
                  ? d.bookings.averageMinor
                    ? t('брони за период, средний чек {amount}', { amount: formatMoney(d.bookings.averageMinor, cur) })
                    : t('брони за период')
                  : undefined
              }
            />
            <ReportCard
              t={t}
              href={`/management/analytics/occupancy?${analyticsQ}`}
              testId="report-occupancy"
              title={t('Загрузка')}
              value={d && formatPercent(d.occupancy.percent)}
              hint={
                d
                  ? t('занято {occupied} из {sellable} ночей к продаже', { occupied: formatInt(d.occupancy.occupiedNights), sellable: formatInt(d.occupancy.sellableNights) })
                  : undefined
              }
            />
            <ReportCard
              t={t}
              href="/market"
              testId="report-market"
              title={t('Анализ конкурентов')}
              hint={t('ваша загрузка рядом с ближайшими отелями на каждую ночь, подсказки к цене')}
            />
            <ReportCard
              t={t}
              href={`/management/analytics/channels?${q}`}
              testId="report-sources"
              title={t('Источники броней')}
              value={d && (topSource ? t(sourceLabel(topSource.source, topSource.channel)) : '—')}
              hint={
                d
                  ? topSource
                    ? t('главный источник, {share} заездов', { share: formatPercent(topSource.share) })
                    : t('заездов за период нет')
                  : undefined
              }
            />
          </Group>
          <Group title={t('День')}>
            <ReportCard
              t={t}
              href="/finance"
              testId="report-day"
              title={t('Сводка дня')}
              value={day && `${day.counts.arrivals} / ${day.counts.departures}`}
              hint={t('заезды / выезды сегодня, в «Финансах»')}
            />
            <ReportCard
              t={t}
              href="/reservations?view=inhouse"
              testId="report-inhouse"
              title={t('Список проживающих')}
              value={day && formatInt(day.counts.inHouse)}
              hint={t('проживаний сейчас, в «Бронях»')}
            />
            <ReportCard
              t={t}
              href="/reports/print?form=day"
              testId="report-print"
              title={t('Печать')}
              hint={t('сводка дня и список проживающих на бумагу, RU и KZ')}
            />
          </Group>
          {mayAccess(shell.access, 'settings') && (
            <Group title={t('Сайт')}>
              <ReportCard
              t={t}
                href="/website/analytics"
                testId="report-website"
                title={t('Аналитика сайта')}
                hint={t('посещения, воронка и брони с сайта, период на самом экране')}
              />
            </Group>
          )}
        </>
      )}
    </Page>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="reports-group">
      <SectionTitle first>{title}</SectionTitle>
      <Grid min={260} gap="sm">
        {children}
      </Grid>
    </section>
  );
}

/**
 * Карточка отчёта: вопрос, живое число за период и переход в готовый экран. `value === null` — свой
 * запрос не ответил: карточка честно говорит «не загрузилось» и остаётся ссылкой. Без `value`
 * (аналитика сайта) — карточка-ссылка без числа.
 */
function ReportCard({
  href,
  title,
  value,
  hint,
  warn,
  testId,
  t,
}: {
  t: Translate;
  href: string;
  title: string;
  value?: string | null;
  hint?: string | undefined;
  warn?: boolean;
  testId: string;
}) {
  return (
    <Link
      href={href}
      className={cx('report-card', warn && 'report-card--warn')}
      data-testid={testId}
    >
      <span className="report-card__title">
        {title}
        <Icon name="chevron" width={16} height={16} aria-hidden="true" />
      </span>
      {value !== undefined && (
        <span className="report-card__value">{value === null ? '—' : value}</span>
      )}
      <span className="report-card__hint">{value === null ? t('не загрузилось') : hint}</span>
    </Link>
  );
}
