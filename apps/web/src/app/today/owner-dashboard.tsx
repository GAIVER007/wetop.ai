import { cache, Suspense } from 'react';
import Link from 'next/link';
import type { ResolvedPeriod } from '@pms/domain';
import { ApiError, dashboardApi, chessboardApi } from '../../lib/api';
import { hotelApi } from '../../lib/hotel-api';
import { formatMoney } from '../../lib/money';
import { formatPercent } from '../../lib/dashboard-format';
import { displayDate } from '../../lib/display-date';
import { Alert } from '../../components/ui';
import { Icon } from '../../components/icon';
import { loadDeskDay } from './desk-section';
import { loadGuardStatus } from './guard-status';
import { DayAttention, attentionCount } from './day-attention';
import { DashboardDetails, DashboardRefresh, ForecastDetails } from './owner-controls';
import { OwnerPlaceholder, AttentionPlaceholder } from './owner-loading';

const loadPeriod = cache((from: string, to: string) =>
  dashboardApi.period(from, to).catch((error: unknown) => {
    if (error instanceof ApiError) return error;
    throw error;
  }),
);
const loadBoard = cache((date: string) =>
  chessboardApi.board(date, date).catch((error: unknown) => {
    if (error instanceof ApiError) return null;
    throw error;
  }),
);

export async function OwnerFinance({ period }: { period: ResolvedPeriod }) {
  const [result, hotel] = await Promise.all([
    loadPeriod(period.from, period.to),
    hotelApi.settings().catch((error: unknown) => {
      if (error instanceof ApiError) return null;
      throw error;
    }),
  ]);
  if (result instanceof ApiError || !hotel)
    return (
      <Alert boxed tone="warning">
        Финансовая аналитика не загрузилась.
        <div className="owner-error-actions">
          <DashboardRefresh label="Повторить" />
          <Link href="/finance">Открыть финансы</Link>
        </div>
      </Alert>
    );
  return (
    <>
      <div className="owner-money-main">
        <div className="owner-income" data-testid="owner-paid">
          <span>Поступления</span>
          <strong>
            <Link href={`/finance?from=${period.from}&to=${period.to}`}>
              {formatMoney(result.current.payments.totalMinor, hotel.property.currency)}
            </Link>
          </strong>
        </div>
        <details className="owner-dates">
          <summary aria-label="Свои даты">
            <span>
              {displayDate(period.from)} – {displayDate(period.to)}
            </span>
            <Icon name="down" width={16} height={16} />
          </summary>
          <form action="/today" key={`${period.from}|${period.to}`}>
            <input type="hidden" name="period" value="custom" />
            <label>
              С
              <input
                type="date"
                aria-label="Начало периода"
                name="from"
                defaultValue={period.from}
                required
              />
            </label>
            <label>
              По
              <input
                type="date"
                aria-label="Конец периода"
                name="to"
                defaultValue={period.to}
                required
              />
            </label>
            <button className="btn btn--secondary">Показать</button>
          </form>
        </details>
      </div>
      <div className="owner-money-secondary">
        {[
          ['Расходы', 'expenses'],
          ['Касса', 'cash'],
          ['Всего', 'total'],
        ].map(([label, id]) => (
          <div data-testid={`owner-${id}`} key={id}>
            <span>{label}</span>
            <strong className="owner-unavailable">Нет данных</strong>
          </div>
        ))}
      </div>
    </>
  );
}

export async function OwnerOutlook({ today }: { today: string }) {
  const end = new Date(`${today}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  const to = end.toISOString().slice(0, 10);
  const result = await loadPeriod(today, to);
  return (
    <div className="owner-outlook">
      <header>
        <h3>Ближайшие 7 дней</h3>
        {!(result instanceof ApiError) && (
          <ForecastDetails>
            <p className="owner-forecast-note">
              По текущим броням. Выберите день, чтобы открыть календарь.
            </p>
            <ol className="owner-forecast-days">
              {result.current.daily.map((day) => (
                <li key={day.date}>
                  <Link href={`/chessboard?from=${day.date}&to=${day.date}`}>
                    <span className="owner-forecast-date">
                      <strong>{displayDate(day.date, 'full')}</strong>
                      <span className="owner-forecast-counts">
                        <span>Занято {day.occupied}</span>
                        <span>Свободно {day.free}</span>
                        {day.blocked > 0 && <span>Недоступно {day.blocked}</span>}
                      </span>
                    </span>
                    <strong className="owner-forecast-percent">{formatPercent(day.percent)}</strong>
                    <Icon name="chevron" width={16} height={16} />
                  </Link>
                </li>
              ))}
            </ol>
          </ForecastDetails>
        )}
      </header>
      {result instanceof ApiError ? (
        <div className="owner-error-actions">
          <p className="owner-caption">Прогноз загрузки недоступен</p>
          <DashboardRefresh label="Повторить" />
        </div>
      ) : (
        <ol className="owner-week" data-testid="owner-outlook-chart" aria-label="Загрузка по дням">
          {result.current.daily.map((day) => (
            <li
              key={day.date}
              aria-label={`${displayDate(day.date, 'full')}: ${formatPercent(day.percent)}, свободно ${day.free}`}
            >
              <Link
                href={`/chessboard?from=${day.date}&to=${day.date}`}
                aria-label={`${displayDate(day.date, 'full')}: загрузка ${formatPercent(day.percent)}, свободно ${day.free}. Открыть календарь`}
                aria-current={day.date === today ? 'date' : undefined}
              >
                <strong>{formatPercent(day.percent)}</strong>
                <div className="owner-week-track" aria-hidden="true">
                  <i style={{ height: `${Math.max(0, Math.min(100, day.percent))}%` }} />
                </div>
                <span>
                  {day.date === today
                    ? 'Сегодня'
                    : new Date(`${day.date}T00:00:00Z`).toLocaleDateString('ru-RU', {
                        weekday: 'short',
                        timeZone: 'UTC',
                      })}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export async function OwnerLoad({ date }: { date: string }) {
  const board = await loadBoard(date);
  const summary = board?.summary[date];
  const total = summary ? summary.occupied + summary.free + summary.blocked : 0;
  const percent = summary && total > 0 ? Math.round((summary.occupied * 1000) / total) / 10 : null;
  return (
    <section className="owner-load owner-surface" aria-label="Загрузка сегодня">
      <header className="owner-section-head">
        <h2>Загрузка сегодня</h2>
        <Link href={`/management/analytics/occupancy?date=${date}`} aria-label="Подробная загрузка">
          <Icon name="external" width={18} height={18} />
        </Link>
      </header>
      <div className="owner-load-main">
        <div className="owner-load-numbers">
          <strong
            className="owner-load-value"
            data-empty={percent === null}
            data-testid="c-occupancy"
          >
            {percent === null ? 'Нет данных' : formatPercent(percent)}
          </strong>
          <dl className="owner-load-counts">
            <div>
              <dt>Занято</dt>
              <dd>{summary?.occupied ?? '…'}</dd>
            </div>
            <div>
              <dt>Свободно</dt>
              <dd data-testid="c-free">{summary?.free ?? '…'}</dd>
            </div>
          </dl>
        </div>
        <div className="owner-ring">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle className="owner-ring-track" cx="60" cy="60" r="50" />
            <circle
              className="owner-ring-fill"
              cx="60"
              cy="60"
              r="50"
              pathLength="100"
              strokeDasharray={`${percent ?? 0} 100`}
            />
          </svg>
          <div>
            <strong>{summary ? total : '…'}</strong>
            <span>мест всего</span>
          </div>
        </div>
      </div>
      {summary?.blocked ? <p className="owner-blocked">Недоступно: {summary.blocked}</p> : null}
      {!summary && (
        <div className="owner-error-actions">
          <p className="owner-caption">Данные фонда недоступны</p>
          <DashboardRefresh label="Повторить" />
        </div>
      )}
      <Suspense
        fallback={
          <div className="owner-outlook">
            <OwnerPlaceholder variant="outlook" label="Загружаем прогноз…" />
          </div>
        }
      >
        <OwnerOutlook today={date} />
      </Suspense>
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
      {hotel ? formatMoney(minor, hotel.property.currency) : 'Нет данных'}
    </strong>
  );
}
export async function OwnerOperations({ date }: { date: string }) {
  const day = await loadDeskDay(date);
  if (day instanceof ApiError)
    return (
      <div className="owner-operations">
        <Alert boxed tone="warning" data-testid="desk-error">
          Данные сегодняшнего дня не загрузились.
          <div className="owner-error-actions">
            <DashboardRefresh label="Повторить" />
            <Link href="/reservations">Открыть брони</Link>
          </div>
        </Alert>
      </div>
    );
  return (
    <>
      <section className="owner-today owner-surface" aria-label="Сегодня">
        <header className="owner-section-head">
          <h2>Сегодня</h2>
          <Link href={`/reservations?date=${date}`} aria-label="Брони сегодня">
            <Icon name="chevron" width={18} height={18} />
          </Link>
        </header>
        <div className="owner-today-values">
          <Link href={`/reservations?arrival=${date}`}>
            <span>Заезды</span>
            <strong>{day.counts.toCheckIn}</strong>
          </Link>
          <Link href={`/reservations?departure=${date}`}>
            <span>Выезды</span>
            <strong>{day.counts.toCheckOut}</strong>
          </Link>
          <Link href={`/reservations?departure=${date}`} aria-label="К оплате у выезжающих сегодня">
            <span>К оплате</span>
            <Suspense fallback={<strong>…</strong>}>
              <DebtAmount minor={day.debtMinor} />
            </Suspense>
          </Link>
        </div>
      </section>
      <Suspense fallback={<AttentionPlaceholder />}>
        <OwnerAttention day={day} date={date} />
      </Suspense>
    </>
  );
}

async function OwnerAttention({
  day,
  date,
}: {
  day: Exclude<Awaited<ReturnType<typeof loadDeskDay>>, ApiError>;
  date: string;
}) {
  const [board, guard] = await Promise.all([loadBoard(date), loadGuardStatus()]);
  const attention = { day, board, guard, isToday: true };
  return (
    <section className="owner-attention" aria-label="Риски на сегодня" data-testid="owner-risks">
      <DashboardDetails title="Требуют внимания" count={attentionCount(attention)}>
        <DayAttention {...attention} />
      </DashboardDetails>
    </section>
  );
}
