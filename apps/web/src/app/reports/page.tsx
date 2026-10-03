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
import '../directory.css';
import './reports.css';

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
  const sp = normalizeSearchParams(await searchParams);
  const cal = periods(await hotelToday());
  const from = sp.from || cal.month.from;
  const to = sp.to || cal.month.to;
  const dates = validDate(from) && validDate(to) && from <= to;
  const days = dates ? nightsBetween(from, to) + 1 : 0;
  const tooLong = dates && days > MAX_REPORT_DAYS;
  const valid = dates && !tooLong;
  const settle = <T,>(p: Promise<T>) => p.then((r) => r, () => null);
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
      : `${displayDate(from, withYear ? 'numeric' : 'short')} → ${displayDate(to, withYear ? 'numeric' : 'short')}`;
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
      title="Отчёты"
      subtitle={
        valid ? (
          <span data-testid="reports-period">
            {periodText}, {pluralRu(days, ['день', 'дня', 'дней'])}
          </span>
        ) : undefined
      }
    >
      <section className="reports-controls" aria-label="Период">
        <form method="get" className="reports-toolbar" data-testid="reports-period-form">
          <Field inline label="С">
            <DateInput key={`from-${from}`} name="from" defaultValue={from} aria-label="Период: с" />
          </Field>
          <Field inline label="По">
            <DateInput
              key={`to-${to}`}
              name="to"
              rangeFromName="from"
              defaultValue={to}
              aria-label="Период: по"
            />
          </Field>
          <nav className="directory-filters reports-presets" aria-label="Готовые периоды">
            {(
              [
                ['Сегодня', { from: cal.today, to: cal.today }],
                ['7 дней', cal.week],
                ['Этот месяц', cal.month],
                ['Прошлый месяц', cal.prevMonth],
              ] as const
            ).map(([label, p]) => (
              <Link
                key={label}
                href={preset(p)}
                className={isPreset(p) ? 'is-active' : ''}
                aria-current={isPreset(p) ? 'page' : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>
          <Button tone="secondary">Показать</Button>
        </form>
        <p className="reports-note">
          Деньги — как на «Оплатах»: начисления по дате услуги, оплаты по дате операции. Загрузка и
          брони — как в «Аналитике»: по заездам периода.
        </p>
      </section>

      {tooLong && (
        <Alert boxed>
          Период отчёта — не больше года ({MAX_REPORT_DAYS} дней) за один запрос. Укоротите период.
        </Alert>
      )}
      {!dates && (
        <Alert boxed>Проверьте даты: окончание периода должно быть не раньше начала.</Alert>
      )}

      {valid && (
        <>
          <Group title="Деньги">
            <ReportCard
              href={`/finance?${q}`}
              testId="report-finance"
              title="Финансы за период"
              value={fin && formatMoney(fin.chargedMinor, cur)}
              hint="начислено: проживание, услуги, штрафы"
            />
            <ReportCard
              href={`/finance?${q}#operations`}
              testId="report-operations"
              title="Оплаты и возвраты"
              value={fin && formatMoney(fin.paidMinor, cur)}
              hint="оплачено за период, с выгрузкой CSV"
            />
            <ReportCard
              href={`/finance?${q}#services`}
              testId="report-services"
              title="Отчёт по услугам"
              value={fin && formatMoney(serviceRow?.amountMinor ?? '0', cur)}
              hint={
                fin
                  ? serviceRow
                    ? `${pluralRu(serviceRow.count, ['начисление', 'начисления', 'начислений'])} за услуги`
                    : 'начислений за услуги за период нет'
                  : undefined
              }
            />
            <ReportCard
              href={`/finance?${q}#debts`}
              testId="report-debts"
              title="Долги"
              warn={due > 0n}
              value={debts && formatMoney(debts.balanceMinor, cur)}
              hint={
                debts
                  ? debts.count > 0
                    ? `к сбору по ${pluralRu(debts.count, ['броне', 'броням', 'броням'])}`
                    : 'все брони периода оплачены'
                  : undefined
              }
            />
          </Group>
          <Group title="Загрузка и продажи">
            <ReportCard
              href={`/management/analytics?${analyticsQ}`}
              testId="report-overview"
              title="Обзор периода"
              value={d && formatInt(d.bookings.total)}
              hint={
                d
                  ? d.bookings.averageMinor
                    ? `брони за период, средний чек ${formatMoney(d.bookings.averageMinor, cur)}`
                    : 'брони за период'
                  : undefined
              }
            />
            <ReportCard
              href={`/management/analytics/occupancy?${analyticsQ}`}
              testId="report-occupancy"
              title="Загрузка"
              value={d && formatPercent(d.occupancy.percent)}
              hint={
                d
                  ? `занято ${formatInt(d.occupancy.occupiedNights)} из ${formatInt(d.occupancy.unitNights)} ночей`
                  : undefined
              }
            />
            <ReportCard
              href="/market"
              testId="report-market"
              title="Загрузка конкурентов"
              hint="ваша загрузка рядом с ближайшими отелями на каждую ночь, подсказки к цене"
            />
            <ReportCard
              href={`/management/analytics/channels?${q}`}
              testId="report-sources"
              title="Источники броней"
              value={d && (topSource ? sourceLabel(topSource.source, topSource.channel) : '—')}
              hint={
                d
                  ? topSource
                    ? `главный источник, ${formatPercent(topSource.share)} заездов`
                    : 'заездов за период нет'
                  : undefined
              }
            />
          </Group>
          <Group title="День">
            <ReportCard
              href="/today"
              testId="report-day"
              title="Сводка дня"
              value={day && `${day.counts.arrivals} / ${day.counts.departures}`}
              hint="заезды / выезды сегодня, на Главной"
            />
            <ReportCard
              href="/reservations?view=inhouse"
              testId="report-inhouse"
              title="Список проживающих"
              value={day && formatInt(day.counts.inHouse)}
              hint="проживаний сейчас, в «Бронях»"
            />
            <ReportCard
              href="/reports/print?form=day"
              testId="report-print"
              title="Печать"
              hint="сводка дня и список проживающих на бумагу, RU и KZ"
            />
          </Group>
          {mayAccess(shell.access, 'settings') && (
            <Group title="Сайт">
              <ReportCard
                href="/website/analytics"
                testId="report-website"
                title="Аналитика сайта"
                hint="посещения, воронка и брони с сайта — период на самом экране"
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
}: {
  href: string;
  title: string;
  value?: string | null;
  hint?: string | undefined;
  warn?: boolean;
  testId: string;
}) {
  return (
    <Link href={href} className={cx('report-card', warn && 'report-card--warn')} data-testid={testId}>
      <span className="report-card__title">
        {title}
        <Icon name="chevron" width={16} height={16} aria-hidden="true" />
      </span>
      {value !== undefined && (
        <span className="report-card__value">{value === null ? '—' : value}</span>
      )}
      <span className="report-card__hint">{value === null ? 'не загрузилось' : hint}</span>
    </Link>
  );
}
