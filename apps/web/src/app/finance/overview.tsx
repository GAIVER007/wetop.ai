import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ApiError,
  type CashBalances,
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
  expense: bigint | null;
  prevIncome: bigint | null;
  prevExpense: bigint | null;
  currency: string;
}

/** Слово периода для подписи плитки выручки: «за месяц», «за 7 дней», «сегодня», «за период» */
export function periodWord(kind: 'today' | 'week' | 'month' | 'custom'): string {
  return kind === 'today'
    ? 'сегодня'
    : kind === 'week'
      ? 'за 7 дней'
      : kind === 'month'
        ? 'за месяц'
        : 'за период';
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
  const { income, expense, prevIncome, prevExpense, currency } = sums;
  const profit = income !== null && expense !== null ? income - expense : null;
  const prevProfit = prevIncome !== null && prevExpense !== null ? prevIncome - prevExpense : null;
  const money = (v: bigint | null) =>
    v === null ? 'Нет данных' : formatMoney(v.toString(), currency);
  return (
    <section className="biz-kpis" aria-label="Ключевые показатели">
      <Stat
        label={`Выручка ${periodLabel}`}
        value={money(income)}
        icon="analytics"
        testId="biz-revenue"
        delta={moneyDelta(income, prevIncome)}
        hint="к прошлому периоду"
      />
      <Stat
        label="Чистая прибыль"
        value={money(profit)}
        icon="money"
        testId="biz-profit"
        delta={moneyDelta(profit, prevProfit)}
        hint="поступления минус расходы"
      />
      <Stat
        label="Загрузка сегодня"
        value={percent === null ? 'Нет данных' : formatPercent(percent)}
        icon="board"
        testId="biz-occupancy"
        delta={percent !== null && prev ? deltaPoints(percent, prev.occupancy.percent) : undefined}
        hint="к вчера"
      />
      <Stat
        label="Заезды сегодня"
        value={counts ? String(counts.arrivals) : 'Нет данных'}
        icon="arrival"
        testId="biz-arrivals-kpi"
        delta={counts ? intDelta(counts.arrivals, prev ? prev.arrivals.count : null) : undefined}
        hint="к вчера"
      />
      <Stat
        label="Выезды сегодня"
        value={counts ? String(counts.departures) : 'Нет данных'}
        icon="departure"
        testId="biz-departures-kpi"
        delta={
          counts ? intDelta(counts.departures, prev ? prev.departures.count : null) : undefined
        }
        hint="к вчера"
      />
      <Stat
        label="К оплате / Долги"
        value={debts ? formatMoney(debts.balanceMinor, currency) : 'Нет данных'}
        icon="card"
        testId="biz-due"
        tone={debts && BigInt(debts.balanceMinor) > 0n ? 'warning' : undefined}
        hint="остаток по броням периода"
      />
      <Stat
        label="Свободно мест"
        value={summary ? String(summary.free) : 'Нет данных'}
        icon="bed"
        testId="biz-free"
        hint={summary ? `из ${total}` : 'данные фонда недоступны'}
      />
    </section>
  );
}

/** Движение денег по дням из строк общей ленты: проведённые оплаты и поступления против возвратов и расходов */
function dailyFlow(rows: PeriodOperations['rows'], from: string, to: string) {
  const days = new Map<string, { income: bigint; expense: bigint }>();
  for (let d = from; d <= to; d = nextDay(d)) days.set(d, { income: 0n, expense: 0n });
  for (const row of rows) {
    if (row.status !== 'COMPLETED' || row.kind === 'TRANSFER') continue;
    const day = days.get(row.localAt.slice(0, 10));
    if (!day) continue;
    if (row.kind === 'PAYMENT' || row.kind === 'INCOME') day.income += BigInt(row.amountMinor);
    else day.expense += BigInt(row.amountMinor);
  }
  return [...days.entries()].map(([date, v]) => ({ date, ...v }));
}
const nextDay = (date: string) => new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10);

/** График по дням рисуем до двух месяцев: дальше столбики уже, чем цель нажатия, и ничего не говорят */
const FLOW_CHART_MAX_DAYS = 62;

export function MoneyOverview({
  sums,
  ops,
  from,
  to,
  cash,
  detailsHref,
}: {
  sums: OverviewSums;
  ops: PeriodOperations | null;
  from: string;
  to: string;
  cash: CashBalances | null;
  detailsHref: string;
}) {
  const { income, expense, prevIncome, prevExpense, currency } = sums;
  const flow =
    ops && Math.round((Date.parse(to) - Date.parse(from)) / 86400000) < FLOW_CHART_MAX_DAYS
      ? dailyFlow(ops.rows, from, to)
      : null;
  const flowMax = flow
    ? flow.reduce(
        (m, d) => (d.income > m ? d.income : m),
        flow.reduce((m, d) => (d.expense > m ? d.expense : m), 1n),
      )
    : 1n;
  const height = (v: bigint) => Number((v * 100n) / flowMax);
  const money = (v: bigint | null) =>
    v === null ? 'Нет данных' : formatMoney(v.toString(), currency);
  const deltaLine = (d: Delta | undefined) =>
    d && (
      <span className="biz-money__delta" data-direction={d.direction ?? 'none'}>
        {d.text} к прошлому периоду
      </span>
    );
  return (
    <section className="biz-money" aria-labelledby="biz-money-title" data-testid="cash-summary">
      <header className="biz-card__head">
        <h2 id="biz-money-title">Финансовый обзор</h2>
        <a className="card-heading__link" href={detailsHref}>
          Подробнее
        </a>
      </header>
      <div className="biz-money__sums">
        <div className="biz-money__sum biz-money__sum--income">
          <span>Поступления</span>
          <strong data-testid="cash-period-income">{money(income)}</strong>
          {deltaLine(moneyDelta(income, prevIncome))}
        </div>
        <div className="biz-money__sum biz-money__sum--expense">
          <span>Расходы</span>
          <strong data-testid="cash-period-expense">{money(expense)}</strong>
          {deltaLine(moneyDelta(expense, prevExpense))}
        </div>
      </div>
      <div className="biz-money__body">
        <div className="biz-money__chart">
          <h3>Движение денег по дням</h3>
          {flow ? (
            <>
              <ol className="biz-flow" data-testid="cash-flow-chart">
                {flow.map((day) => (
                  <li
                    key={day.date}
                    aria-label={`${displayDate(day.date, 'full')}: поступления ${formatMoney(day.income.toString(), currency)}, расходы ${formatMoney(day.expense.toString(), currency)}`}
                  >
                    <span className="biz-flow__bars" aria-hidden="true">
                      {/* slop-allow: inline-style высота столбика из данных дня */}
                      <i
                        className="biz-flow__in"
                        style={{ height: `${Math.max(2, height(day.income))}%` }}
                      />
                      {/* slop-allow: inline-style высота столбика из данных дня */}
                      <i
                        className="biz-flow__out"
                        style={{ height: `${Math.max(2, height(day.expense))}%` }}
                      />
                    </span>
                  </li>
                ))}
              </ol>
              <div className="biz-flow__axis" aria-hidden="true">
                <span>{displayDate(from)}</span>
                <span>{displayDate(to)}</span>
              </div>
              <p className="biz-card__note">
                <span className="biz-dot biz-dot--income" aria-hidden="true" /> поступления
                {'  '}
                <span className="biz-dot biz-dot--expense" aria-hidden="true" /> расходы
                {ops?.truncated ? '; лента обрезана, график по последним операциям периода' : ''}
              </p>
            </>
          ) : (
            <p className="biz-card__note">
              {ops
                ? 'Период длиннее двух месяцев: по дням смотрите короткий отрезок'
                : 'Операции за период не загрузились'}
            </p>
          )}
        </div>
        <div className="biz-money__accounts">
          <h3>Остаток на счетах</h3>
          <strong data-testid="cash-balance">
            {cash ? formatMoney(cash.totalMinor, cash.currency) : 'Нет данных'}
          </strong>
          {cash && (
            <dl>
              {cash.balances.map((balance, i) => (
                <div key={balance.method}>
                  <dt>
                    <span className={`biz-dot biz-dot--${(i % 4) + 1}`} aria-hidden="true" />
                    {METHOD_RU[balance.method] ?? balance.method}
                  </dt>
                  <dd>{formatMoney(balance.balanceMinor, cash.currency)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </section>
  );
}

export function PaymentMethods({
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
  return (
    <section className="biz-methods" aria-labelledby="biz-methods-title">
      <header className="biz-card__head">
        <h2 id="biz-methods-title">Поступления по способам оплаты</h2>
        <a className="card-heading__link" href={opsHref('')}>
          Подробнее
        </a>
      </header>
      {!report ? (
        <p className="biz-card__note">Итоги периода не загрузились</p>
      ) : rows.length === 0 ? (
        <p className="biz-card__note">Оплат за период нет</p>
      ) : (
        <ul className="biz-methods__list">
          {rows.map((row) => (
            <li key={row.method}>
              <a href={opsHref(row.method)}>{METHOD_RU[row.method] ?? row.method}</a>
              <strong>{formatMoney(row.amountMinor, report.currency)}</strong>
              <ShareBar
                label={`Доля способа «${METHOD_RU[row.method] ?? row.method}»`}
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
  date,
  debts,
  period,
  currency,
}: {
  date: string;
  debts: PeriodDebts | null;
  period: string;
  currency: string;
}) {
  const day = await loadDeskDay(date);
  if (day instanceof ApiError)
    return (
      <section className="biz-today" aria-labelledby="biz-today-title">
        <header className="biz-card__head">
          <h2 id="biz-today-title">Сегодня</h2>
        </header>
        <Alert boxed tone="warning" data-testid="desk-error">
          Данные сегодняшнего дня не загрузились.
          <div className="owner-error-actions">
            <DashboardRefresh label="Повторить" />
            <Link href="/reservations">Открыть брони</Link>
          </div>
        </Alert>
      </section>
    );
  const tiles: Array<[string, IconName, number, string]> = [
    ['Заезды', 'arrival', day.counts.arrivals, `/reservations?arrival=${date}`],
    ['Выезды', 'departure', day.counts.departures, `/reservations?departure=${date}`],
    ['Ожидают заселения', 'clock', day.counts.toCheckIn, `/reservations?arrival=${date}`],
    ['Ожидают выезда', 'booking', day.counts.toCheckOut, `/reservations?departure=${date}`],
  ];
  const testIds: Record<string, string> = { Заезды: 'biz-arrivals', Выезды: 'biz-departures' };
  return (
    <section className="biz-today" aria-labelledby="biz-today-title">
      <header className="biz-card__head">
        <h2 id="biz-today-title">Сегодня</h2>
        <span className="biz-card__caption">{displayDate(date, 'full')}</span>
      </header>
      <div className="biz-today__tiles">
        {tiles.map(([label, icon, count, href]) => (
          <Link key={label} href={href} className="biz-today__tile">
            <span className="biz-today__icon" aria-hidden="true">
              <Icon name={icon} />
            </span>
            <span className="biz-today__label">{label}</span>
            <strong {...(testIds[label] ? { 'data-testid': testIds[label] } : {})}>{count}</strong>
          </Link>
        ))}
      </div>
      {debts && debts.count > 0 && (
        <Link href={`${period}#debts`} className="biz-today__debts">
          <span className="biz-today__icon" aria-hidden="true">
            <Icon name="card" />
          </span>
          <span>
            Брони без оплаты <b>{debts.count}</b>
          </span>
          <strong>{formatMoney(debts.balanceMinor, currency)}</strong>
          <Icon name="chevron" width={16} height={16} aria-hidden="true" />
        </Link>
      )}
      <p className="biz-card__note">
        К оплате у выезжающих:{' '}
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
      title: 'Брони без оплаты',
      caption: `на сумму ${formatMoney(debts.balanceMinor, debts.currency)}`,
      href: `${period}#debts`,
      tone: 'warning',
    });
  if (debts && debts.overdue.count > 0)
    rows.push({
      key: 'overdue',
      count: debts.overdue.count,
      title: 'Просроченные платежи',
      caption: 'время выезда прошло, остаток не оплачен',
      href: `${period}&debts=overdue#debts`,
      tone: 'danger',
    });
  if (lowDays.length > 0)
    rows.push({
      key: 'low-load',
      count: lowDays.length,
      title: 'Низкая загрузка',
      caption: `${displayDate(lowDays[0]!.date)} и дальше: ниже 40 %`,
      href: `/chessboard?from=${lowDays[0]!.date}&to=${lowDays[0]!.date}`,
      tone: 'info',
    });
  if (!(day instanceof ApiError) && day.counts.tasksOpen > 0)
    rows.push({
      key: 'tasks',
      count: day.counts.tasksOpen,
      title: 'Задачи',
      caption: pluralRu(day.counts.tasksOpen, [
        'открытая задача со сроком',
        'открытые задачи со сроком',
        'открытых задач со сроком',
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
        <h2 id="biz-attention-title">Что требует внимания</h2>
      </header>
      {rows.length === 0 ? (
        <p className="biz-card__note">
          <Icon name="check" aria-hidden="true" /> Сейчас всё спокойно
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
          title="Требуют внимания"
          label="Все задачи"
          count={attentionCount(attention)}
        >
          <DayAttention {...attention} />
        </DashboardDetails>
      )}
    </section>
  );
}

const RECENT_SHOWN = 7;

export function RecentOperations({
  ops,
  period,
}: {
  ops: PeriodOperations | null;
  period: string;
}) {
  return (
    <section className="biz-recent" aria-labelledby="biz-recent-title" data-testid="recent-ops">
      <header className="biz-card__head">
        <h2 id="biz-recent-title">Последние операции</h2>
        <a className="card-heading__link" href={`${period}&show=1#operations`}>
          Все операции
        </a>
      </header>
      {!ops ? (
        <p className="biz-card__note">Операции за период не загрузились</p>
      ) : ops.rows.length === 0 ? (
        <p className="biz-card__note">Операций за период нет</p>
      ) : (
        <Table size="sm" className="biz-recent__table" aria-label="Таблица последних операций">
          <thead>
            <tr>
              <th>Дата и время</th>
              <th>Тип</th>
              <th>Описание</th>
              <th className="num">Сумма</th>
              <th>Способ</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {ops.rows.slice(0, RECENT_SHOWN).map((o) => {
              const [opDay = '', time = ''] = o.localAt.split(' ');
              const minus = o.kind === 'REFUND' || o.kind === 'EXPENSE';
              return (
                <tr key={`${o.kind}-${o.id}`} data-testid="recent-op-row">
                  <td data-label="Дата и время">
                    <time dateTime={o.at}>
                      {displayDate(opDay)}, {time}
                    </time>
                  </td>
                  <td data-label="Тип">{operationKind(o.kind)}</td>
                  <td data-label="Описание">
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
                    data-label="Сумма"
                    className={`num ${minus ? 'biz-recent__amount--out' : 'biz-recent__amount--in'}`}
                  >
                    {minus ? '−' : '+'}
                    {formatMoney(o.amountMinor, ops.currency)}
                  </td>
                  <td data-label="Способ">
                    {o.kind === 'TRANSFER' && o.methodTo
                      ? `${METHOD_RU[o.method] ?? o.method} → ${METHOD_RU[o.methodTo] ?? o.methodTo}`
                      : (METHOD_RU[o.method] ?? o.method)}
                  </td>
                  <td data-label="Статус">
                    <Badge tone="neutral">{operationStatus(o.kind, o.status)}</Badge>
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
