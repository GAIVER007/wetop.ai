import Link from 'next/link';
import { type DeskDay } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { Icon } from '../../components/icon';
import { displayDate } from '../../lib/display-date';

/** Ссылки на уже существующие действия. Один пункт на проживание, причины показаны вместе. */
function attentionItems(day: DeskDay) {
  const arrivals = day.arrivals.filter(
    (r) =>
      (r.status === 'CONFIRMED' || r.status === 'TENTATIVE') &&
      (r.blockedReason || !r.unitCode || r.guestsRecorded < r.adults),
  );
  const departures = day.departures.filter((r) => BigInt(r.balanceMinor) > 0n);
  // Не заехали вовремя (срез 5 → срез 14): место занято, а ни в одном списке дня их нет
  const overdue = day.overdueArrivals;
  const count = arrivals.length + departures.length + overdue.length;
  return { arrivals, departures, overdue, count };
}

export function AttentionSummary({ day, date }: { day: DeskDay; date: string }) {
  const { count } = attentionItems(day);
  return (
    <a href="#day-attention" className="attention-summary" data-testid="attention-summary">
      <Icon name={count ? 'clock' : 'check'} />
      <span>
        <strong>Требуют внимания: {count}</strong>
        <small>
          Задачи на {displayDate(date)}
          {count === 0 ? '. Всё в порядке' : '. Открыть список'}
        </small>
      </span>
      <Icon name="chevron" />
    </a>
  );
}

export function DayAttention({ day }: { day: DeskDay }) {
  const { arrivals, departures, overdue, count } = attentionItems(day);
  return (
    <section className="attention-card" id="day-attention">
      <div className="attention-heading">
        <h2>Требуют внимания</h2>
        <span className="attention-count">{count}</span>
      </div>
      {count === 0 ? (
        <div className="attention-empty">
          <Icon name="check" />
          <strong>Всё в порядке</strong>
          <p>Нет незавершённых карточек, просроченных заездов и долгов уезжающих.</p>
        </div>
      ) : (
        <div className="attention-list">
          {overdue.map((r) => (
            <Link
              key={`overdue-${r.itemId}`}
              href={`/reservations/${encodeURIComponent(r.confirmationNumber)}#booking-actions`}
              className="attention-item attention-item--overdue"
              data-testid="overdue-arrival"
            >
              <span className="attention-icon">
                <Icon name="clock" />
              </span>
              <span>
                <strong>{r.guestLabel || r.confirmationNumber}</strong>
                <small>
                  <span className="booking-number">{r.confirmationNumber}</span> · Не заехал {displayDate(r.arrivalDate)}: заселить или отметить незаезд
                  {r.blockedReason ? ` · ${r.blockedReason}` : ''}
                </small>
              </span>
              <Icon name="chevron" />
            </Link>
          ))}
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
                  <span className="booking-number">{r.confirmationNumber}</span> ·{' '}
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
                <small>
                  <span className="booking-number">{r.confirmationNumber}</span> · К оплате{' '}
                  {formatMoney(r.balanceMinor)}
                </small>
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
