import Link from 'next/link';
import { formatMinor, type DeskDay } from '../../lib/api';
import { Icon } from '../../components/icon';

/** Ссылки на уже существующие действия. Один пункт на проживание, причины показаны вместе. */
export function DayAttention({ day }: { day: DeskDay }) {
  const arrivals = day.arrivals.filter(
    (r) =>
      (r.status === 'CONFIRMED' || r.status === 'TENTATIVE') &&
      (r.blockedReason || !r.unitCode || r.guestsRecorded < r.adults),
  );
  const departures = day.departures.filter((r) => BigInt(r.balanceMinor) > 0n);
  const count = arrivals.length + departures.length;
  return (
    <section className="attention-card">
      <div className="attention-heading">
        <h2>Требуют внимания</h2>
        <span className="attention-count">{count}</span>
      </div>
      {count === 0 ? (
        <div className="attention-empty">
          <Icon name="check" />
          <strong>Всё в порядке</strong>
          <p>Нет незавершённых карточек и долгов уезжающих.</p>
        </div>
      ) : (
        <div className="attention-list">
          {arrivals.map((r) => (
            <Link
              key={`arrival-${r.itemId}`}
              href={`/reservations/${encodeURIComponent(r.confirmationNumber)}#booking-actions`}
              className="attention-item"
            >
              <span className="attention-icon">
                <Icon name="guests" />
              </span>
              <span>
                <strong>{r.guestLabel || r.confirmationNumber}</strong>
                <small>
                  {r.blockedReason ||
                    (!r.unitCode
                      ? 'Назначить номер или койку'
                      : `Заполнить карточки: ${r.guestsRecorded} из ${r.adults}`)}
                </small>
              </span>
              <Icon name="chevron" />
            </Link>
          ))}
          {departures.map((r) => (
            <Link
              key={`debt-${r.itemId}`}
              href={`/reservations/${encodeURIComponent(r.confirmationNumber)}#booking-finance`}
              className="attention-item attention-item--debt"
            >
              <span className="attention-icon">
                <Icon name="money" />
              </span>
              <span>
                <strong>{r.guestLabel || r.confirmationNumber}</strong>
                <small>К оплате {formatMinor(r.balanceMinor)}</small>
              </span>
              <Icon name="chevron" />
            </Link>
          ))}
        </div>
      )}
      <div className="attention-footer">
        <Icon name="clock" /> По данным выбранного дня
      </div>
    </section>
  );
}
