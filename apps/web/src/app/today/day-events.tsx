import Link from 'next/link';
import { type DeskDay, type DeskRow } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { Icon } from '../../components/icon';
import { Panel, PanelTitle } from '../../components/ui';

/** Строк в колонке; остальное — ссылкой в «Брони» (план A2 §3.1) */
const ROWS = 6;

const waiting = (r: DeskRow) => r.status === 'CONFIRMED' || r.status === 'TENTATIVE';

export interface HotelHours {
  checkIn: string;
  checkOut: string;
}

/**
 * Заезды и выезды дня (A2, ТЗ `plans/tz-today-2026-09-27.md` §4, план `plans/today-a2-2026-09-28.md` §3.1).
 * Только то, что уже пришло с `/desk/today`: новых вызовов нет. Действие — ссылка в существующий поток
 * (шахматка, карточка брони); заселения из строки в A2 нет — это вопрос владельцу (план §8).
 * Времени у брони нет — в заголовке часы объекта, строки идут в порядке API.
 */
export function DayEvents({ day, hours }: { day: DeskDay; hours: HotelHours | null }) {
  const arrivals = day.arrivals.filter(waiting);
  const settled = day.arrivals.length - arrivals.length;
  const leaving = day.departures.filter((r) => r.status === 'CHECKED_IN');
  const gone = day.departures.filter((r) => r.status === 'CHECKED_OUT').length;
  // Выезд по брони, по которой не заселяли: в «Выселить» не годится, но и молча пропадать не должна
  const notArrived = day.departures.filter(waiting).length;
  return (
    <div className="dash-grid dash-grid--events">
      <Panel
        aria-label="Заезды"
        className="day-events"
      >
        <PanelTitle>
          <span className="day-events__title">
            <Icon name="arrival" width={16} />
            Заезды
            {hours ? <span className="day-events__time">с {hours.checkIn}</span> : null}
          </span>
        </PanelTitle>
        <EventList
          rows={arrivals.slice(0, ROWS)}
          empty={day.arrivals.length ? 'Все заезды дня уже заселены' : 'Заездов нет'}
          action={(r) =>
            r.unitCode
              ? {
                  label: 'Заселить',
                  href: `/reservations/${encodeURIComponent(r.confirmationNumber)}#booking-actions`,
                }
              : {
                  label: 'Назначить',
                  href: `/chessboard?from=${day.date}&to=${day.date}#unassigned-stays`,
                }
          }
        />
        <EventsFooter
          notes={[settled ? `уже заселены: ${settled}` : null]}
          all={{ label: `Все заезды дня (${day.arrivals.length})`, href: `/reservations?arrival=${day.date}` }}
          show={day.arrivals.length > 0}
        />
      </Panel>
      <Panel
        aria-label="Выезды"
        className="day-events"
      >
        <PanelTitle>
          <span className="day-events__title">
            <Icon name="departure" width={16} />
            Выезды
            {hours ? <span className="day-events__time">до {hours.checkOut}</span> : null}
          </span>
        </PanelTitle>
        <EventList
          rows={leaving.slice(0, ROWS)}
          empty={day.departures.length ? 'Все выезды дня оформлены' : 'Выездов нет'}
          action={(r) => ({
            label: 'Выселить',
            href: `/reservations/${encodeURIComponent(r.confirmationNumber)}#booking-actions`,
          })}
        />
        <EventsFooter
          notes={[
            gone ? `уже выехали: ${gone}` : null,
            notArrived ? `не заезжали: ${notArrived}` : null,
          ]}
          all={{
            label: `Все выезды дня (${day.departures.length})`,
            href: `/reservations?departure=${day.date}`,
          }}
          show={day.departures.length > 0}
        />
      </Panel>
    </div>
  );
}

function EventList({
  rows,
  empty,
  action,
}: {
  rows: DeskRow[];
  empty: string;
  action: (r: DeskRow) => { label: string; href: string };
}) {
  if (!rows.length) return <p className="day-events__empty">{empty}</p>;
  return (
    <ul className="day-events__list">
      {rows.map((r) => {
        const act = action(r);
        const debt = BigInt(r.balanceMinor) > 0n;
        return (
          <li key={r.itemId} className="day-event" data-testid="event-row">
            <span className="day-event__text">
              <span className="attention-item__head">
                <strong>{r.guestLabel || r.confirmationNumber}</strong>
                <span className="booking-number">{r.confirmationNumber}</span>
              </span>
              <span className="day-event__meta">
                <span>{r.accommodationTypeName}</span>
                {r.unitCode ? (
                  <span className="day-event__unit">{r.unitCode}</span>
                ) : (
                  <span className="day-event__warn">⚠ без ячейки</span>
                )}
                {debt && <span className="day-event__debt">к оплате {formatMoney(r.balanceMinor)}</span>}
              </span>
              {r.blockedReason && <span className="day-event__reason">{r.blockedReason}</span>}
            </span>
            <Link className="btn btn--secondary btn--sm day-event__action" href={act.href}>
              {act.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function EventsFooter({
  notes,
  all,
  show,
}: {
  notes: Array<string | null>;
  all: { label: string; href: string };
  show: boolean;
}) {
  if (!show) return null;
  const words = notes.filter((n): n is string => n !== null);
  return (
    <div className="day-events__footer">
      {words.map((n) => (
        <span key={n}>{n}</span>
      ))}
      <Link className="card-heading__link" href={all.href}>
        {all.label}
        <Icon name="chevron" width={14} />
      </Link>
    </div>
  );
}
