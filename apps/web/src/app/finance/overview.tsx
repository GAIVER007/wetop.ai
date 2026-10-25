import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ApiError,
  type PeriodDebts,
  type PeriodOperations,
  type PeriodReport,
} from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { deltaPercent, deltaPoints, formatPercent, type Delta } from '../../lib/dashboard-format';
import { displayDate } from '../../lib/display-date';
import { pluralRu } from '../../lib/plural';
import { Icon, type IconName } from '../../components/icon';
import { ShareBar } from '../../components/share-bar';
import { Alert, Badge, Stat, Table } from '../../components/ui';
import { METHOD_RU, operationKind, operationStatus } from './labels';
import { loadBoard, loadPeriod } from './owner-dashboard';
import { loadDeskDay } from './desk-section';
import { loadGuardStatus } from './guard-status';
import { DashboardDetails, DashboardRefresh } from './owner-controls';
import { DayAttention, attentionCount } from './day-attention';
import { intlLocale, msg } from '../../i18n';
import { currentLocale, serverT } from '../../i18n/server';

/**
 * «Обзор бизнеса» (план plans/finance-overview-2026-10-09.md, по макету владельца 09.10.2026):
 * плитки показателей, финансовый обзор, способы оплаты, «Сегодня», «Что требует внимания» и
 * последние операции. Все числа считает сервер; суммы складываются в BigInt; числа с макета
 * вымышленные и в код не переносятся.
 */

/** Изменение целого счётчика к вчера: «+3», «−2»; сравнивать не с чем — дельты нет */
function intDelta(current: number, previous: number | null): Delta | undefined {
  if (previous === null) return undefined;
  const diff = current - previous;
  return {
    direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
    text: `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${Math.abs(diff)}`,
  };
}

const moneyDelta = (current: bigint | null, previous: bigint | null): Delta | undefined =>
  current === null || previous === null ? undefined : deltaPercent(current, previous);

export interface OverviewSums {
  income: bigint | null;
  /** Возвраты гостям за период: отдельная строка, не часть расходов (решение владельца 13.10.2026) */
  refunds: bigint | null;
  /** Расходы кассы без возвратов */
  expense: bigint | null;
  prevIncome: bigint | null;
  prevRefunds: bigint | null;
  prevExpense: bigint | null;
  currency: string;
}

/** Слово периода для подписи плитки выручки: «за месяц», «за 7 дней», «сегодня», «за период» */
export function periodWord(kind: 'today' | 'week' | 'month' | 'custom'): string {
  return kind === 'today'
    ? msg('сегодня')
    : kind === 'week'
      ? msg('за 7 дней')
      : kind === 'month'
        ? msg('за месяц')
        : msg('за период');
}

export async function BizKpis({
  sums,
  periodLabel,
  debts,
  date,
  yesterday,
}: {
  sums: OverviewSums;
  periodLabel: string;
  debts: PeriodDebts | null;
  date: string;
  yesterday: string;
}) {
  const [board, day, before] = await Promise.all([
    loadBoard(date),
    loadDeskDay(date),
    loadPeriod(yesterday, yesterday),
  ]);
  const summary = board?.summary[date];
  const total = summary ? summary.occupied + summary.free + summary.blocked : 0;
  const percent = summary && total > 0 ? Math.round((summary.occupied * 1000) / total) / 10 : null;
  const prev = before instanceof ApiError ? null : before.current;
  const counts = day instanceof ApiError ? null : day.counts;
  const { income, refunds, expense, prevIncome, prevRefunds, prevExpense, currency } = sums;
  const profit =
    income !== null && refunds !== null && expense !== null ? income - refunds - expense : null;
  const prevProfit =
    prevIncome !== null && prevRefunds !== null && prevExpense !== null
      ? prevIncome - prevRefunds - prevExpense
      : null;
  const money = (v: bigint | null) => (v === null ? '—' : formatMoney(v.toString(), currency));
  const t = await serverT();
  return (
    <section className="biz-kpis" aria-label={t('Ключевые показатели')}>
      <Stat
        label={t('Выручка {period}', { period: t(periodLabel) })}
        value={money(income)}
        icon={<Icon name="analytics" />}
        testId="biz-revenue"
        delta={moneyDelta(income, prevIncome)}
        hint={t('к прошлому периоду')}
      />
      <Stat
        label={t('Чистая прибыль')}
        value={money(profit)}
        icon={<Icon name="money" />}
        testId="biz-profit"
        delta={moneyDelta(profit, prevProfit)}
        hint={t('поступления минус возвраты и расходы')}
      />
      <Stat
        label={t('Загрузка сегодня')}
        value={percent === null ? '—' : formatPercent(percent)}
        icon={<Icon name="board" />}
        testId="biz-occupancy"
        delta={percent !== null && prev ? deltaPoints(percent, prev.occupancy.percent) : undefined}
        hint={t('к вчера')}
      />
      <Stat
        label={t('Заезды сегодня')}
        value={counts ? String(counts.arrivals) : '—'}
        icon={<Icon name="arrival" />}
        testId="biz-arrivals-kpi"
        delta={counts ? intDelta(counts.arrivals, prev ? prev.arrivals.count : null) : undefined}
        hint={t('к вчера')}
      />
      <Stat
        label={t('Выезды сегодня')}
        value={counts ? String(counts.departures) : '—'}
        icon={<Icon name="departure" />}
        testId="biz-departures-kpi"
        delta={
          counts ? intDelta(counts.departures, prev ? prev.departures.count : null) : undefined
        }
        hint={t('к вчера')}
      />
      <Stat
        label={t('К оплате / Долги')}
        value={debts ? formatMoney(debts.balanceMinor, currency) : '—'}
        icon={<Icon name="card" />}
        testId="biz-due"
        tone={debts && BigInt(debts.balanceMinor) > 0n ? 'warning' : undefined}
        hint={t('остаток по броням периода')}
      />
      <Stat
        label={t('Свободно мест')}
        value={summary ? String(summary.free) : '—'}
        icon={<Icon name="bed" />}
        testId="biz-free"
        hint={summary ? t('из {n}', { n: total }) : t('данные фонда недоступны')}
      />
    </section>
  );
}

const nextDay = (date: string) => new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10);

export async function PaymentMethods({
  report,
  opsHref,
}: {
  report: PeriodReport | null;
  opsHref: (method: string) => string;
}) {
  const rows = report
    ? [...report.paymentsByMethod].sort((a, b) => {
        const d = BigInt(b.amountMinor) - BigInt(a.amountMinor);
        return d > 0n ? 1 : d < 0n ? -1 : 0;
      })
    : [];
  const paid = report ? BigInt(report.paidMinor) : 0n;
  const t = await serverT();
  return (
    <section className="biz-methods" aria-labelledby="biz-methods-title">
      <header className="biz-card__head">
        <h2 id="biz-methods-title">{t('Поступления по способам оплаты')}</h2>
        <a className="card-heading__link" href={opsHref('')}>
          {t('Подробнее')}
        </a>
      </header>
      {!report ? (
        <p className="biz-card__note">{t('Итоги периода не загрузились')}</p>
      ) : rows.length === 0 ? (
        <p className="biz-card__note">{t('Оплат за период нет')}</p>
      ) : (
        <ul className="biz-methods__list">
          {rows.map((row) => (
            <li key={row.method}>
              <a href={opsHref(row.method)}>{t(METHOD_RU[row.method] ?? row.method)}</a>
              <strong>{formatMoney(row.amountMinor, report.currency)}</strong>
              <ShareBar
                label={t('Доля способа «{method}»', { method: t(METHOD_RU[row.method] ?? row.method) })}
                value={paid > 0n ? Number((BigInt(row.amountMinor) * 100n) / paid) : 0}
                showValue
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export async function TodayCard({
  showDebts = true,
  date,
  debts,
  period,
  currency,
}: {
  showDebts?: boolean;
  date: string;
  debts: PeriodDebts | null;
  period: string;
  currency: string;
}) {
  const day = await loadDeskDay(date);
  const t = await serverT();
  if (day instanceof ApiError)
    return (
      <section className="biz-today" aria-labelledby="biz-today-title">
        <header className="biz-card__head">
          <h2 id="biz-today-title">{t('Сегодня')}</h2>
        </header>
        <Alert boxed tone="warning" data-testid="desk-error">
          {t('Данные сегодняшнего дня не загрузились.')}
          <div className="owner-error-actions">
            <DashboardRefresh label={t('Повторить')} />
            <Link href="/reservations">{t('Открыть брони')}</Link>
          </div>
        </Alert>
      </section>
    );
  const tiles: Array<[string, IconName, number, string]> = [
    [msg('Заезды'), 'arrival', day.counts.arrivals, `/reservations?arrival=${date}`],
    [msg('Выезды'), 'departure', day.counts.departures, `/reservations?departure=${date}`],
    [msg('Ожидают заселения'), 'clock', day.counts.toCheckIn, `/reservations?arrival=${date}`],
    [msg('Ожидают выезда'), 'booking', day.counts.toCheckOut, `/reservations?departure=${date}`],
  ];
  const testIds: Record<string, string> = { Заезды: 'biz-arrivals', Выезды: 'biz-departures' }; // kk-allow: ключи сверки с русской подписью, не текст экрана
  return (
    <section className="biz-today" aria-labelledby="biz-today-title">
      <header className="biz-card__head">
        <h2 id="biz-today-title">{t('Сегодня')}</h2>
        <span className="biz-card__caption">{displayDate(date, 'full', intlLocale(await currentLocale()))}</span>
      </header>
      <div className="biz-today__tiles">
        {tiles.map(([label, icon, count, href]) => (
          <Link key={label} href={href} className="biz-today__tile">
            <span className="biz-today__icon" aria-hidden="true">
              <Icon name={icon} />
            </span>
            <span className="biz-today__label">{t(label)}</span>
            <strong {...(testIds[label] ? { 'data-testid': testIds[label] } : {})}>{count}</strong>
          </Link>
        ))}
      </div>
      {showDebts && debts && debts.count > 0 && (
        <Link href={`${period}#debts`} className="biz-today__debts">
          <span className="biz-today__icon" aria-hidden="true">
            <Icon name="card" />
          </span>
          <span>
            {t('Брони без оплаты')} <b>{debts.count}</b>
          </span>
          <strong>{formatMoney(debts.balanceMinor, currency)}</strong>
          <Icon name="chevron" width={16} height={16} aria-hidden="true" />
        </Link>
      )}
      <p className="biz-card__note">
        {t('К оплате у выезжающих:')}{' '}
        <strong data-testid="c-debt">{formatMoney(day.debtMinor, currency)}</strong>
      </p>
    </section>
  );
}

export async function AttentionCard({
  date,
  debts,
  period,
}: {
  date: string;
  debts: PeriodDebts | null;
  period: string;
}) {
  const end = nextDay(nextDay(nextDay(nextDay(nextDay(nextDay(date))))));
  const [day, board, guard, outlook] = await Promise.all([
    loadDeskDay(date),
    loadBoard(date),
    loadGuardStatus(),
    loadPeriod(date, end),
  ]);
  const t = await serverT();
  const lowDays =
    outlook instanceof ApiError ? [] : outlook.current.daily.filter((d) => d.percent < 40);
  const rows: Array<{
    key: string;
    count: number;
    title: string;
    caption: ReactNode;
    href: string;
    tone: 'danger' | 'warning' | 'info';
  }> = [];
  if (debts && debts.count > 0)
    rows.push({
      key: 'unpaid',
      count: debts.count,
      title: t('Брони без оплаты'),
      caption: t('на сумму {sum}', { sum: formatMoney(debts.balanceMinor, debts.currency) }),
      href: `${period}#debts`,
      tone: 'warning',
    });
  if (debts && debts.overdue.count > 0)
    rows.push({
      key: 'overdue',
      count: debts.overdue.count,
      title: t('Просроченные платежи'),
      caption: t('время выезда прошло, остаток не оплачен'),
      href: `${period}&debts=overdue#debts`,
      tone: 'danger',
    });
  // Уборка в видимом списке (13.10.2026): без неё «Все задачи 86» не сходилось с пунктами списка
  const dirty = board?.rows.filter((r) => r.unit.housekeepingStatus === 'DIRTY').length ?? 0;
  if (dirty > 0)
    rows.push({
      key: 'dirty',
      count: dirty,
      title: t('Нужна уборка'),
      caption: pluralRu(dirty, [t('место ждёт уборки'), t('места ждут уборки'), t('мест ждут уборки')]),
      href: '/chessboard',
      tone: 'warning',
    });
  if (lowDays.length > 0)
    rows.push({
      key: 'low-load',
      count: lowDays.length,
      title: t('Низкая загрузка'),
      caption: t('{date} и дальше: ниже 40 %', { date: displayDate(lowDays[0]!.date) }),
      href: `/chessboard?from=${lowDays[0]!.date}&to=${lowDays[0]!.date}`,
      tone: 'info',
    });
  if (!(day instanceof ApiError) && day.counts.tasksOpen > 0)
    rows.push({
      key: 'tasks',
      count: day.counts.tasksOpen,
      title: t('Задачи'),
      caption: pluralRu(day.counts.tasksOpen, [
        t('открытая задача со сроком'),
        t('открытые задачи со сроком'),
        t('открытых задач со сроком'),
      ]),
      href: '/tasks',
      tone: 'info',
    });
  const attention = day instanceof ApiError ? null : { day, board, guard, isToday: true as const };
  return (
    <section
      className="biz-attention"
      aria-labelledby="biz-attention-title"
      data-testid="owner-risks"
    >
      <header className="biz-card__head">
        <h2 id="biz-attention-title">{t('Что требует внимания')}</h2>
      </header>
      {rows.length === 0 ? (
        <p className="biz-card__note">
          <Icon name="check" aria-hidden="true" /> {t('Сейчас всё спокойно')}
        </p>
      ) : (
        <ul className="biz-attention__list">
          {rows.map((row) => (
            <li key={row.key} data-tone={row.tone}>
              <Link href={row.href}>
                <b className="biz-attention__count">{row.count}</b>
                <span className="biz-attention__text">
                  <strong>{row.title}</strong>
                  <small>{row.caption}</small>
                </span>
                <Icon name="chevron" width={16} height={16} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {attention && (
        <DashboardDetails
          title={t('Требуют внимания')}
          label={t('Все задачи')}
          count={attentionCount(attention)}
        >
          <DayAttention {...attention} />
        </DashboardDetails>
      )}
    </section>
  );
}

const RECENT_SHOWN = 7;

export async function RecentOperations({
  ops,
  period,
}: {
  ops: PeriodOperations | null;
  period: string;
}) {
  const t = await serverT();
  return (
    <section className="biz-recent" aria-labelledby="biz-recent-title" data-testid="recent-ops">
      <header className="biz-card__head">
        <h2 id="biz-recent-title">{t('Последние операции')}</h2>
        <a className="card-heading__link" href={`${period}&show=1#operations`}>
          {t('Все операции')}
        </a>
      </header>
      {!ops ? (
        <p className="biz-card__note">{t('Операции за период не загрузились')}</p>
      ) : ops.rows.length === 0 ? (
        <p className="biz-card__note">{t('Операций за период нет')}</p>
      ) : (
        <Table size="sm" className="biz-recent__table" aria-label={t('Таблица последних операций')}>
          <thead>
            <tr>
              <th>{t('Дата и время')}</th>
              <th>{t('Тип')}</th>
              <th>{t('Описание')}</th>
              <th className="num">{t('Сумма')}</th>
              <th>{t('Способ')}</th>
              <th>{t('Статус')}</th>
            </tr>
          </thead>
          <tbody>
            {ops.rows.slice(0, RECENT_SHOWN).map((o) => {
              const [opDay = '', time = ''] = o.localAt.split(' ');
              const minus = o.kind === 'REFUND' || o.kind === 'EXPENSE';
              return (
                <tr key={`${o.kind}-${o.id}`} data-testid="recent-op-row">
                  <td data-label={t('Дата и время')}>
                    <time dateTime={o.at}>
                      {displayDate(opDay)}, {time}
                    </time>
                  </td>
                  <td data-label={t('Тип')}>{t(operationKind(o.kind))}</td>
                  <td data-label={t('Описание')}>
                    {o.guestLabel || o.category || '—'}
                    {o.confirmationNumber && (
                      <Link
                        href={`/reservations/${encodeURIComponent(o.confirmationNumber)}#booking-finance`}
                        className="booking-number"
                      >
                        {' '}
                        {o.confirmationNumber}
                      </Link>
                    )}
                  </td>
                  <td
                    data-label={t('Сумма')}
                    className={`num ${minus ? 'biz-recent__amount--out' : 'biz-recent__amount--in'}`}
                  >
                    {minus ? '−' : '+'}
                    {formatMoney(o.amountMinor, ops.currency)}
                  </td>
                  <td data-label={t('Способ')}>
                    {o.kind === 'TRANSFER' && o.methodTo
                      ? `${t(METHOD_RU[o.method] ?? o.method)} → ${t(METHOD_RU[o.methodTo] ?? o.methodTo)}`
                      : t(METHOD_RU[o.method] ?? o.method)}
                  </td>
                  <td data-label={t('Статус')}>
                    <Badge tone="neutral">{t(operationStatus(o.kind, o.status))}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </section>
  );
}
