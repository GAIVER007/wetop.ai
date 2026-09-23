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
  // Причины одним списком — для разбивки в блоке и для сводки сверху: слова и числа одни и те же
  const reasons = [
    { label: 'Просроченные заезды', count: overdue.length },
    { label: 'Карточки гостей', count: arrivals.length },
    { label: 'Долги уезжающих', count: departures.length },
  ];
  return { arrivals, departures, overdue, count, reasons };
}

/**
 * Сводка над показателями (ADR-049: компактное резюме с датой, ведёт к задачам ниже). Разбор 23.09.2026,
 * находка 3: задачи смены стоят под аналитикой, и сводка говорила только «Требуют внимания: 2» —
 * чтобы узнать, что именно, надо было прокрутить три экрана. Теперь она называет причины с числами;
 * порядок блоков — решение владельца, его не трогаем. Раньше дата и «Открыть список» склеивались
 * в «23 сент.. Открыть».
 */
export function AttentionSummary({ day, date }: { day: DeskDay; date: string }) {
  const { count, reasons } = attentionItems(day);
  const named = reasons
    .filter((r) => r.count > 0)
    .map((r) => `${r.label.toLocaleLowerCase('ru')} ${r.count}`)
    .join(', ');
  return (
    <a href="#day-attention" className="attention-summary" data-testid="attention-summary">
      <Icon name={count ? 'clock' : 'check'} />
      <span>
        <strong>Требуют внимания: {count}</strong>
        <small>
          {count === 0
            ? `На ${displayDate(date)} всё в порядке`
            : `На ${displayDate(date)}: ${named}`}
        </small>
      </span>
      <Icon name="chevron" />
    </a>
  );
}

export function DayAttention({ day }: { day: DeskDay }) {
  const { arrivals, departures, overdue, count, reasons } = attentionItems(day);
  /*
   * Разбивка по причинам стоит и при нуле: смена видит, что именно проверено, а не одно слово
   * «всё в порядке». Числа те же, что в списке ниже, — считаются из одного `attentionItems`.
   * День без броней разбивку не показывает: считать там нечего, и три нуля были бы шумом.
   */
  const hasDay = day.arrivals.length + day.departures.length + day.inHouse.length > 0;
  return (
    <section className="attention-card" id="day-attention">
      <div className="attention-heading">
        <h2>Требуют внимания</h2>
        <span className="attention-count" data-state={count ? 'on' : 'off'}>
          {count}
        </span>
      </div>
      {hasDay ? (
        <ul className="attention-tally" data-testid="attention-tally">
          {reasons.map((row) => (
            <li key={row.label} data-state={row.count ? 'on' : 'off'}>
              <strong>{row.count}</strong>
              <span>{row.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {count === 0 ? (
        <div className="attention-empty">
          <Icon name="check" />
          <strong>Всё в порядке</strong>
          <p>Нет незавершённых карточек, просроченных заездов и долгов уезжающих.</p>
        </div>
      ) : (
        /*
         * Имя гостя и номер брони — одной строкой, что сделать — строкой ниже: раньше всё, кроме имени,
         * шло одной серой строкой через точку-разделитель (§14), и глаз не находил, где действие (находка 7).
         */
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
              <span className="attention-item__text">
                <span className="attention-item__head">
                  <strong>{r.guestLabel || r.confirmationNumber}</strong>
                  <span className="booking-number">{r.confirmationNumber}</span>
                </span>
                <small>
                  Не заехал {displayDate(r.arrivalDate)}: заселить или отметить незаезд
                </small>
                {r.blockedReason && <small>Не готово к заселению: {r.blockedReason}</small>}
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
              <span className="attention-item__text">
                <span className="attention-item__head">
                  <strong>{r.guestLabel || r.confirmationNumber}</strong>
                  <span className="booking-number">{r.confirmationNumber}</span>
                </span>
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
              <span className="attention-item__text">
                <span className="attention-item__head">
                  <strong>{r.guestLabel || r.confirmationNumber}</strong>
                  <span className="booking-number">{r.confirmationNumber}</span>
                </span>
                <small>К оплате {formatMoney(r.balanceMinor)}</small>
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
