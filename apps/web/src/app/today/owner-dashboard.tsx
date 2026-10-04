import { cache, Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import type { ResolvedPeriod } from '@pms/domain';
import { ApiError, dashboardApi, chessboardApi } from '../../lib/api';
import { hotelApi } from '../../lib/hotel-api';
import { formatMoney } from '../../lib/money';
import {
  sourceLabel,
  formatPercent,
  deltaPercent,
  deltaPoints,
  type Delta,
} from '../../lib/dashboard-format';
import { displayDate } from '../../lib/display-date';
import { DayBars } from '../../components/day-bars';
import { Alert } from '../../components/ui';
import { loadDeskDay } from './desk-section';
import { loadGuardStatus } from './guard-status';
import { DayAttention } from './day-attention';
import { DashboardDetails } from './owner-controls';
import { moneyBarHeight } from './owner-metrics';
import { TodayWidgets } from './today-widgets';

const loadPeriod = cache((from: string, to: string) =>
  dashboardApi.period(from, to).catch((error: unknown) => {
    if (error instanceof ApiError) return error;
    throw error;
  }),
);
function Metric({
  label,
  value,
  note,
  href,
  id,
  delta,
}: {
  label: string;
  value: string;
  note: ReactNode;
  href?: string;
  id?: string;
  /** изменение к прошлому отрезку той же длины; без базы не показывается */
  delta?: Delta | undefined;
}) {
  return (
    <div className="owner-stat" data-testid={id}>
      <span>{label}</span>
      <strong>{href ? <Link href={href}>{value}</Link> : value}</strong>
      <small>
        {delta?.direction && (
          <b className={`owner-delta owner-delta--${delta.direction}`}>{delta.text}</b>
        )}
        {note}
      </small>
    </div>
  );
}
export async function OwnerFinance({
  period,
  currency,
  today,
}: {
  period: ResolvedPeriod;
  currency: string;
  today: string;
}) {
  const result = await loadPeriod(period.from, period.to);
  if (result instanceof ApiError)
    return (
      <div className="owner-finance">
        <Alert boxed tone="warning">
          Финансовая аналитика не загрузилась. Обновите страницу или откройте{' '}
          <Link href="/finance">финансы</Link>. Данные не заменены нулями.
        </Alert>
      </div>
    );
  const c = result.current;
  const p = result.previous;
  const money = (value: string | bigint) => formatMoney(value, currency);
  const finance = `/finance?from=${period.from}&to=${period.to}`;
  const analytics = `/management/analytics?period=custom&from=${period.from}&to=${period.to}`;
  const max = c.daily.reduce(
    (value, day) => (BigInt(day.revenueMinor) > value ? BigInt(day.revenueMinor) : value),
    0n,
  );
  return (
    <>
      <section className="owner-finance" aria-label="Финансы за выбранный период">
        <div className="owner-row-label">
          <span>
            {displayDate(period.from)} — {displayDate(period.to)}
          </span>
          <Link href={finance}>Все операции</Link>
        </div>
        <div className="owner-stats">
          <Metric
            label="Начислено"
            value={money(c.revenue.totalMinor)}
            note="все начисления за период"
            delta={deltaPercent(BigInt(c.revenue.totalMinor), BigInt(p.revenue.totalMinor))}
            href={finance}
            id="owner-charged"
          />
          <Metric
            label="Получено оплат"
            value={money(c.payments.totalMinor)}
            note={
              <span data-testid="owner-refunds">Возвраты: {money(c.refundsMinor)}</span>
            }
            delta={deltaPercent(BigInt(c.payments.totalMinor), BigInt(p.payments.totalMinor))}
            href={finance}
            id="owner-paid"
          />
          <Metric
            label="Средняя цена ночи"
            value={c.adrMinor ? money(c.adrMinor) : '—'}
            note={c.adrMinor ? 'за проданную ночь' : 'Проданных ночей нет'}
            delta={
              c.adrMinor && p.adrMinor
                ? deltaPercent(BigInt(c.adrMinor), BigInt(p.adrMinor))
                : undefined
            }
            href={analytics}
            id="owner-adr"
          />
          <Metric
            label="Загрузка за период"
            value={formatPercent(c.occupancy.percent)}
            note={`${c.occupancy.occupiedNights} из ${c.occupancy.unitNights} ночей`}
            delta={deltaPoints(c.occupancy.percent, p.occupancy.percent)}
            href={`/management/analytics/occupancy?period=custom&from=${period.from}&to=${period.to}`}
            id="owner-occupancy"
          />
        </div>
      </section>
      <section className="owner-charts" aria-label="Аналитика за выбранный период">
        <article className="owner-panel">
          <header>
            <h2>Начисления по дням</h2>
            <Link href={analytics}>Отчёт</Link>
          </header>
          <DayBars
            testId="owner-revenue-chart"
            today={today}
            days={c.daily.map((day) => ({
              date: day.date,
              height: moneyBarHeight(day.revenueMinor, max),
              facts: money(day.revenueMinor),
            }))}
          />
          <p className="owner-caption">Только проживание, по дате заезда</p>
        </article>
        <article className="owner-panel">
          <header>
            <h2>Загрузка, {formatPercent(c.occupancy.percent)}</h2>
            <Link
              href={`/management/analytics/occupancy?period=custom&from=${period.from}&to=${period.to}`}
            >
              Фонд
            </Link>
          </header>
          <DayBars
            testId="owner-occupancy-chart"
            today={today}
            days={c.daily.map((day) => ({
              date: day.date,
              height: day.percent,
              facts: `${formatPercent(day.percent)}, занято ${day.occupied}`,
            }))}
          />
          <p className="owner-caption">Номера и койки; блокировки входят в фонд</p>
        </article>
        <article className="owner-panel">
          <header>
            <h2>Источники броней</h2>
            <Link href={analytics}>Все</Link>
          </header>
          <div className="owner-source-list">
            {c.sources.length ? (
              [...c.sources]
                .sort((a, b) => b.count - a.count)
                .slice(0, 3)
                .map((s) => (
                  <div className="owner-source" key={`${s.source}|${s.channel}`}>
                    <span>{sourceLabel(s.source, s.channel)}</span>
                    <strong>{s.count}</strong>
                    <small>{money(s.amountMinor)}</small>
                  </div>
                ))
            ) : (
              <p className="owner-caption">Заездов за период нет</p>
            )}
          </div>
          <div className="owner-bookings">
            <span>
              Брони <b>{c.bookings.total}</b>
            </span>
            <span>
              Отмены <b>{c.bookings.cancelled}</b>
            </span>
            <span>
              Незаезды <b>{c.bookings.noShow}</b>
            </span>
          </div>
          <p className="owner-caption">По дате заезда; суммы — стоимость размещений</p>
        </article>
      </section>
    </>
  );
}
async function DebtAmount({ minor }: { minor: string }) {
  const hotel = await hotelApi.settings().catch((error: unknown) => {
    if (error instanceof ApiError) return null;
    throw error;
  });
  return (
    <strong data-testid="c-debt">
      {hotel ? formatMoney(minor, hotel.property.currency) : 'Валюта недоступна'}
    </strong>
  );
}
export async function OwnerOperations({ date }: { date: string }) {
  const result = await Promise.all([
    loadDeskDay(date).then((day) => {
      if (day instanceof ApiError) throw day;
      return day;
    }),
    chessboardApi.board(date, date).catch((error: unknown) => {
      if (error instanceof ApiError) return null;
      throw error;
    }),
    loadGuardStatus(),
  ]).catch((error: unknown) => {
    if (error instanceof ApiError) return error;
    throw error;
  });
  if (result instanceof ApiError)
    return (
      <div className="owner-operations">
        <Alert boxed tone="warning" data-testid="desk-error">
          Данные стойки не загрузились. Обновите страницу.{' '}
          <Link href="/reservations">Открыть брони</Link>
        </Alert>
      </div>
    );
  const [day, board, guard] = result;
  return (
    <section className="owner-operations" aria-label="Гостиница сегодня">
      <div className="owner-row-label">
        <h2>Сегодня</h2>
        <span>{displayDate(date, 'numeric')}</span>
        <span className="owner-debt">
          К оплате у выезжающих:{' '}
          <Suspense fallback={<strong>…</strong>}>
            <DebtAmount minor={day.debtMinor} />
          </Suspense>
        </span>
        <DashboardDetails title="Требуют внимания">
          <DayAttention day={day} board={board} guard={guard} isToday />
        </DashboardDetails>
        <Link href={`/chessboard?from=${date}&to=${date}`}>Календарь</Link>
      </div>
      <TodayWidgets day={day} board={board} />
    </section>
  );
}
