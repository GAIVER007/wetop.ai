import { cache, Suspense } from 'react';
import Link from 'next/link';
import type { ResolvedPeriod } from '@pms/domain';
import { ApiError, dashboardApi, chessboardApi } from '../../lib/api';
import { hotelApi } from '../../lib/hotel-api';
import { formatMoney } from '../../lib/money';
import { sourceLabel, formatPercent } from '../../lib/dashboard-format';
import { displayDate } from '../../lib/display-date';
import { DayBars } from '../../components/day-bars';
import { Alert } from '../../components/ui';
import { loadDeskDay } from './desk-section';
import { loadGuardStatus } from './guard-status';
import { DayAttention } from './day-attention';
import { QuickActions } from './dashboard-widgets';
import { DayEvents } from './day-events';
import { FundPanel, CarePanel } from './fund-care';
import { DashboardDetails } from './owner-controls';
import { checkedInAdults, moneyBarHeight } from './owner-metrics';

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
}: {
  label: string;
  value: string;
  note: string;
  href?: string;
  id?: string;
}) {
  return (
    <div className="owner-stat" data-testid={id}>
      <span>{label}</span>
      <strong>{href ? <Link href={href}>{value}</Link> : value}</strong>
      <small>{note}</small>
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
          <h2>Финансы</h2>
          <span>
            {displayDate(period.from)} — {displayDate(period.to)}
          </span>
          <Link href={finance}>Все операции</Link>
        </div>
        <div className="owner-stats">
          <Metric
            label="Начислено"
            value={money(c.revenue.totalMinor)}
            note="Проживание целиком в день заезда"
            href={finance}
            id="owner-charged"
          />
          <Metric
            label="Получено оплат"
            value={money(c.payments.totalMinor)}
            note={`За вычетом возвратов: ${money(BigInt(c.payments.totalMinor) - BigInt(c.refundsMinor))}`}
            href={finance}
            id="owner-paid"
          />
          <Metric
            label="Возвраты"
            value={money(c.refundsMinor)}
            note="Возвращено гостям за период"
            href={finance}
            id="owner-refunds"
          />
          <Metric
            label="Расходы бизнеса"
            value="—"
            note="Не подключён учёт расходов"
            id="owner-expenses"
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
  const summary = board?.summary[date];
  const total = summary ? summary.occupied + summary.free + summary.blocked : 0;
  const notReady = board?.rows.filter(
    (row) => row.unit.housekeepingStatus && row.unit.housekeepingStatus !== 'INSPECTED',
  ).length;
  return (
    <>
      <section className="owner-operations" aria-label="Гостиница сегодня">
        <div className="owner-row-label">
          <h2>Гостиница сегодня</h2>
          <span>{displayDate(date, 'numeric')}</span>
          <Link href={`/chessboard?from=${date}&to=${date}`}>Шахматка</Link>
        </div>
        <div className="owner-stats">
          <Metric
            label="Гости на месте"
            value={String(checkedInAdults(day))}
            note="Взрослые в заселённых размещениях"
            href={`/reservations?date=${date}`}
            id="owner-guests"
          />
          <Metric
            label="Загрузка сегодня"
            value={
              summary && total
                ? formatPercent(Math.round((summary.occupied * 1000) / total) / 10)
                : '—'
            }
            note={
              summary
                ? `Занято ${summary.occupied} из ${total} номеров и коек`
                : 'Шахматка недоступна'
            }
            href={`/management/analytics/occupancy?date=${date}`}
            id="c-occupancy"
          />
          <Metric
            label="Свободно"
            value={summary ? String(summary.free) : '—'}
            note={summary ? `Заблокировано: ${summary.blocked}` : 'Нет данных фонда'}
            href={`/rooms/availability?arrival=${date}`}
            id="c-free"
          />
          <Metric
            label="Заезды / выезды"
            value={`${day.counts.toCheckIn} / ${day.counts.toCheckOut}`}
            note="Ожидают заселения / выезда сегодня"
            href={`/reservations?date=${date}`}
            id="owner-movements"
          />
        </div>
      </section>
      <section className="owner-bottom" aria-label="Внимание и действия">
        <div>
          <span>К оплате у выезжающих</span>
          <Suspense fallback={<strong>…</strong>}>
            <DebtAmount minor={day.debtMinor} />
          </Suspense>
          <small>Ещё заселённые, выезд сегодня</small>
        </div>
        <div>
          <span>Уборка и проверка</span>
          <strong>{notReady ?? '—'}</strong>
          <small>Мест не готовы сейчас</small>
        </div>
        <div className="owner-bottom__actions">
          <DashboardDetails title="Требуют внимания">
            <DayAttention day={day} board={board} guard={guard} isToday />
          </DashboardDetails>
          <DashboardDetails title="Работа с гостями">
            <QuickActions day={day} />
            <DayEvents day={day} />
            <FundPanel day={day} board={board} isToday />
            <CarePanel date={date} board={board} isToday />
          </DashboardDetails>
          <Link href="/incidents" className="owner-system-link">
            Контроль системы
          </Link>
        </div>
      </section>
    </>
  );
}
