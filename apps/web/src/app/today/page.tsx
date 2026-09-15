import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import Link from 'next/link';
import { deskApi, chessboardApi, formatMinor, ApiError } from '../../lib/api';
import { hotelApi } from '../../lib/hotel-api';
import { DayWorkspace } from './day-workspace';
import { DayAttention } from './day-attention';
import { Icon, type IconName } from '../../components/icon';
import { Page } from '../../components/page';
import { Button, Input } from '../../components/ui';
import { QuickActions, OccupancyRing, HotelClock } from './dashboard-widgets';
import { displayDate } from '../../lib/display-date';

/** Рабочий пульт стойки. Показатели целиком из DeskDay, без придуманных сравнений/процентов. */
export default async function TodayPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = normalizeSearchParams(await searchParams);
  const [day, hotel] = await Promise.all([
    deskApi.today(sp.date),
    hotelApi.settings().catch((error: unknown) => {
      if (error instanceof ApiError) return null;
      throw error;
    }),
  ]);
  const end = new Date(`${day.date}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  const board = await chessboardApi
    .board(day.date, end.toISOString().slice(0, 10))
    .catch(() => null);
  const debt = BigInt(day.debtMinor) > 0n;
  const metrics: Array<{
    label: string;
    value: string;
    id: string;
    icon: IconName;
    tone: string;
    hint: string;
    count?: number;
    countId?: string;
  }> = [
    {
      label: 'Проживают',
      value: String(day.counts.inHouse),
      id: 'c-inhouse',
      icon: 'bed',
      tone: 'home',
      hint: 'активных размещений',
    },
    {
      label: 'Заезды сегодня',
      value: String(day.counts.arrivals),
      id: 'c-arrivals',
      icon: 'arrival',
      tone: 'arrival',
      hint: 'ожидают заселения',
      count: day.counts.toCheckIn,
      countId: 'c-tocheckin',
    },
    {
      label: 'Выезды сегодня',
      value: String(day.counts.departures),
      id: 'c-departures',
      icon: 'departure',
      tone: 'departure',
      hint: 'ожидают выезда',
      count: day.counts.toCheckOut,
      countId: 'c-tocheckout',
    },
    {
      label: 'Свободно',
      value: board ? String(board.summary[day.date]?.free ?? 0) : '—',
      id: 'c-free',
      icon: 'inventory',
      tone: 'free',
      hint: 'номеров и койко-мест',
    },
    {
      label: 'Долг уезжающих',
      value: formatMinor(day.debtMinor),
      id: 'c-debt',
      icon: 'money',
      tone: debt ? 'debt' : 'paid',
      hint: debt ? 'Проверьте расчёт перед выездом' : 'Все счета оплачены',
    },
  ];
  return (
    <Page
      title="Обзор дня"
      crumbs={<span className="eyebrow">{hotel?.property.name ?? 'Гостиница'}</span>}
      subtitle={
        <>
          <span>Всё важное для спокойной смены.</span>
        </>
      }
      actions={
        <form method="get" className="row day-date-picker">
          <HotelClock timezone={hotel?.property.timezone ?? 'Asia/Almaty'} />
          <Input type="date" name="date" aria-label="Дата рабочего дня" defaultValue={day.date} />
          <Button type="submit" tone="secondary">
            Показать
          </Button>
        </form>
      }
    >
      <section className="desk-metrics" aria-label="Сводка рабочего дня">
        {metrics.map((m) => (
          <article key={m.id} className={`desk-metric desk-metric--${m.tone}`}>
            <div className="desk-metric-top">
              <span>{m.label}</span>
              <span className="desk-metric-icon">
                <Icon name={m.icon} />
              </span>
            </div>
            <strong className="desk-metric-value" data-testid={m.id}>
              {m.value}
            </strong>
            <div className="desk-metric-hint">
              {m.count !== undefined && <span data-testid={m.countId}>{m.count}</span>} {m.hint}
            </div>
          </article>
        ))}
      </section>
      <div className="operations-grid">
        <Upcoming title="Ближайшие заезды" rows={day.arrivals} icon="arrival" date={day.date} />
        <Upcoming title="Ближайшие выезды" rows={day.departures} icon="departure" date={day.date} />
        <aside aria-label="Задачи и размещение">
          <DayAttention day={day} />
        </aside>
      </div>
      <div className="dashboard-action-row">
        <QuickActions day={day} />
        <OccupancyRing board={board} date={day.date} />
      </div>
      <DayWorkspace day={day} />
    </Page>
  );
}

function Upcoming({
  title,
  rows,
  icon,
  date,
}: {
  title: string;
  rows: import('../../lib/api').DeskRow[];
  icon: IconName;
  date: string;
}) {
  return (
    <section className="upcoming-card">
      <div className="card-heading">
        <h2>
          <Icon name={icon} width={16} />
          {title}
        </h2>
        <Link href={`/reservations?date=${date}`} aria-label={`${title}: весь список`}>
          <Icon name="arrow" width={16} />
        </Link>
      </div>
      <div className="upcoming-list">
        {rows.slice(0, 4).map((r) => (
          <Link
            href={`/reservations/${encodeURIComponent(r.confirmationNumber)}`}
            className="upcoming-row"
            key={r.itemId}
          >
            <span className="guest-initials">
              {r.guestLabel
                .split(' ')
                .slice(0, 2)
                .map((n) => n[0])
                .join('')}
            </span>
            <span>
              <strong>{r.guestLabel}</strong>
              <small>
                {r.adults} гост. · {r.unitCode ?? 'Без номера'}
              </small>
            </span>
            <span className="upcoming-status">
              <i className={r.status === 'CHECKED_IN' ? 'legend-green' : 'legend-blue'} />
              {r.status === 'CHECKED_OUT'
                ? 'Выехал'
                : r.status === 'CHECKED_IN'
                  ? 'Проживает'
                  : 'Ожидается'}
            </span>
            <Icon name="chevron" width={14} />
          </Link>
        ))}
        {!rows.length && (
          <div className="empty-state">
            <Icon name={icon} />
            <h3>{icon === 'arrival' ? 'Нет заездов на сегодня' : 'Нет выездов на сегодня'}</h3>
            <p>{displayDate(date, 'full')}</p>
          </div>
        )}
      </div>
      <div className="upcoming-footer">
        {rows.length} размещений{' '}
        <Link href={`/reservations?date=${date}`}>
          Все брони <Icon name="arrow" width={12} />
        </Link>
      </div>
    </section>
  );
}
