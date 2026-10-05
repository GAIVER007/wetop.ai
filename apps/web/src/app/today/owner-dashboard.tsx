import { cache, Suspense } from 'react';
import Link from 'next/link';
import { dateRange, type ResolvedPeriod } from '@pms/domain';
import { ApiError, dashboardApi, chessboardApi } from '../../lib/api';
import { hotelApi } from '../../lib/hotel-api';
import { formatMoney } from '../../lib/money';
import { formatPercent } from '../../lib/dashboard-format';
import { displayDate } from '../../lib/display-date';
import { DayBars } from '../../components/day-bars';
import { Alert } from '../../components/ui';
import { loadDeskDay } from './desk-section';
import { loadGuardStatus } from './guard-status';
import { DayAttention } from './day-attention';
import { DashboardDetails } from './owner-controls';
import { checkedInAdults } from './owner-metrics';

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
}: {
  period: ResolvedPeriod;
  currency: string;
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
  return (
    <section className="owner-finance" aria-label="Финансы за выбранный период">
      <div className="owner-row-label">
        <h2>Деньги</h2>
        <span>
          {displayDate(period.from)} – {displayDate(period.to)}
        </span>
        <Link href={finance}>Подробнее</Link>
      </div>
      <div className="owner-stats">
        <Metric
          label="Поступления"
          value={money(c.payments.totalMinor)}
          note="Оплаты за выбранный период"
          href={finance}
          id="owner-paid"
        />
        <Metric
          label="Расходы"
          value="Нет данных"
          note="Не подключён учёт расходов"
          id="owner-expenses"
        />
        <Metric
          label="Касса"
          value="Нет данных"
          note="Остаток кассы не подключён"
          href={finance}
          id="owner-cash"
        />
        <Metric
          label="Всего"
          value="Нет данных"
          note="Общий остаток не подключён"
          href={finance}
          id="owner-total"
        />
      </div>
    </section>
  );
}
export async function OwnerOutlook({ today }: { today: string }) {
  const end = new Date(`${today}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  const to = dateRange(today, end.toISOString().slice(0, 10)).at(-1)!;
  const result = await loadPeriod(today, to);
  return (
    <section className="owner-outlook owner-panel" aria-label="Загрузка ближайших семи дней">
      <header>
        <h2>Ближайшие 7 дней</h2>
        <Link href={`/chessboard?from=${today}&to=${to}`}>Календарь</Link>
      </header>
      {result instanceof ApiError ? (
        <p className="owner-caption">Прогноз загрузки недоступен</p>
      ) : (
        <DayBars
          today={today}
          testId="owner-outlook-chart"
          days={result.current.daily.map((day) => ({
            date: day.date,
            height: day.percent,
            facts: `${formatPercent(day.percent)}, свободно ${day.free}`,
          }))}
        />
      )}
    </section>
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
  return (
    <>
      <section className="owner-operations" aria-label="Гостиница сегодня">
        <div className="owner-row-label">
          <h2>Гостиница сегодня</h2>
          <span>{displayDate(date, 'numeric')}</span>
          <Link href={`/chessboard?from=${date}&to=${date}`}>Шахматка</Link>
        </div>
        <div className="owner-stats owner-today-stats">
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
                : 'Нет данных'
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
            value={summary ? String(summary.free) : 'Нет данных'}
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
        {summary && total > 0 && (
          <div className="owner-fill" aria-label={`Занято ${summary.occupied} из ${total}`}>
            <progress max={total} value={summary.occupied} />
            <span>
              Занято {summary.occupied} из {total}, свободно {summary.free}
            </span>
          </div>
        )}
      </section>
      <section className="owner-bottom" aria-label="Внимание и действия">
        <div>
          <span>К оплате у выезжающих</span>
          <Suspense fallback={<strong>…</strong>}>
            <DebtAmount minor={day.debtMinor} />
          </Suspense>
          <small>Ещё заселённые, выезд сегодня</small>
        </div>
        <div className="owner-bottom__actions">
          <DashboardDetails title="Требуют внимания">
            <DayAttention day={day} board={board} guard={guard} isToday />
          </DashboardDetails>
          <Link className="btn btn--secondary" href={`/reservations?date=${date}`}>
            Брони сегодня
          </Link>
          <Link href="/incidents" className="owner-system-link">
            Контроль системы
          </Link>
        </div>
      </section>
    </>
  );
}
