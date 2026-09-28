import Link from 'next/link';
import { type Chessboard, type DeskDay, type DeskRow, type GuardStatus } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { pluralRu } from '../../lib/plural';
import { displayDate } from '../../lib/display-date';
import { Icon } from '../../components/icon';
import { Badge, type BadgeTone } from '../../components/ui';

type Severity = 'critical' | 'warning' | 'info';

const SEVERITY: Record<Severity, { word: string; tone: BadgeTone; rank: number }> = {
  critical: { word: 'Критично', tone: 'danger', rank: 0 },
  warning: { word: 'Важно', tone: 'warn', rank: 1 },
  info: { word: 'К сведению', tone: 'neutral', rank: 2 },
};

/** Строк броней под событием; остальное — «ещё N» и ссылка действия */
const ROWS = 3;

interface BookingRow {
  key: string;
  name: string;
  number: string;
  note: string;
  href: string;
  testId?: string;
}

interface AttentionEvent {
  key: string;
  severity: Severity;
  count: number;
  text: string;
  action: { label: string; href: string };
  rows?: BookingRow[];
}

const card = (number: string, anchor: 'booking-actions' | 'booking-finance') =>
  `/reservations/${encodeURIComponent(number)}#${anchor}`;
const waiting = (r: DeskRow) => r.status === 'CONFIRMED' || r.status === 'TENTATIVE';

/**
 * Очередь «Требуют внимания» (A3; ТЗ §5, план `plans/today-a3-2026-09-28.md`). Только данные, которые экран уже загрузил
 * (день стойки, шахматка дня, статус сторожа), и только существующие правила: пороги и важность инцидентов — сторожа,
 * «не готово» — уборка ≠ «проверено». С чем человек ничего не может сделать, сюда не попадает: у каждой строки действие.
 * Уборка и инциденты — текущее состояние, поэтому только на сегодня.
 */
function attentionEvents(input: {
  day: DeskDay;
  board: Chessboard | null;
  guard: GuardStatus | null;
  isToday: boolean;
}): AttentionEvent[] {
  const { day, board, guard, isToday } = input;
  const chessboard = `/chessboard?from=${day.date}&to=${day.date}`;
  const arrivals = day.arrivals.filter(waiting);
  const events: AttentionEvent[] = [];
  const push = (e: AttentionEvent) => {
    if (e.count > 0) events.push(e);
  };
  const bookingRow = (r: DeskRow, note: string, anchor: 'booking-actions' | 'booking-finance', testId?: string) => ({
    key: `${r.itemId}-${anchor}`,
    name: r.guestLabel || r.confirmationNumber,
    number: r.confirmationNumber,
    note,
    href: card(r.confirmationNumber, anchor),
    ...(testId ? { testId } : {}),
  });

  // Critical
  if (isToday && guard)
    push({
      key: 'incidents-critical',
      severity: 'critical',
      count: guard.open.critical,
      text: `${pluralRu(guard.open.critical, ['критичная неисправность', 'критичные неисправности', 'критичных неисправностей'])} системы`,
      action: { label: 'Посмотреть', href: '/incidents' },
    });
  // Без ячейки: шахматка дня знает все такие брони, день стойки — только заезды; имя гостя берём из дня стойки
  const known = new Map(
    [...day.arrivals, ...day.overdueArrivals, ...day.inHouse, ...day.departures].map((r) => [r.confirmationNumber, r]),
  );
  const unassigned = board
    ? [...new Map(board.unassigned.map((u) => [u.confirmationNumber, u.categoryName])).entries()].map(
        ([number, category]) => ({ number, category, name: known.get(number)?.guestLabel || number }),
      )
    : arrivals
        .filter((r) => !r.unitCode)
        .map((r) => ({
          number: r.confirmationNumber,
          category: r.accommodationTypeName,
          name: r.guestLabel || r.confirmationNumber,
        }));
  push({
    key: 'unassigned',
    severity: 'critical',
    count: unassigned.length,
    text: `${pluralRu(unassigned.length, ['бронь', 'брони', 'броней'])} без ячейки`,
    action: { label: 'Назначить', href: `${chessboard}#unassigned-stays` },
    rows: unassigned.map((u) => ({
      key: `${u.number}-unassigned`,
      name: u.name,
      number: u.number,
      note: `${u.category}, нет ячейки: назначить номер или койку`,
      href: card(u.number, 'booking-actions'),
    })),
  });
  if (isToday && board) {
    const hk = new Map(board.rows.map((r) => [r.unit.code, r.unit.housekeepingStatus]));
    const notReady = arrivals.filter((r) => r.unitCode && hk.get(r.unitCode) !== 'INSPECTED');
    push({
      key: 'not-ready',
      severity: 'critical',
      count: notReady.length,
      text: `${pluralRu(notReady.length, ['заезд', 'заезда', 'заездов'])} сегодня в неготовую ячейку`,
      action: { label: 'Открыть шахматку', href: chessboard },
      rows: notReady.map((r) => bookingRow(r, `Ячейка ${r.unitCode}: уборка не проверена`, 'booking-actions')),
    });
  }

  // Warning
  push({
    key: 'no-show',
    severity: 'warning',
    count: day.overdueArrivals.length,
    text: `${pluralRu(day.overdueArrivals.length, ['гость не заехал', 'гостя не заехали', 'гостей не заехали'])} вовремя`,
    action: { label: 'Брони с проблемами', href: '/reservations?view=attention' },
    rows: day.overdueArrivals.map((r) =>
      bookingRow(
        r,
        `Не заехал ${displayDate(r.arrivalDate)}: заселить или отметить незаезд`,
        'booking-actions',
        'overdue-arrival',
      ),
    ),
  });
  const departureDebt = day.departures.filter((r) => BigInt(r.balanceMinor) > 0n);
  push({
    key: 'departure-debt',
    severity: 'warning',
    count: departureDebt.length,
    text: `${pluralRu(departureDebt.length, ['уезжающий', 'уезжающих', 'уезжающих'])} с долгом`,
    action: { label: 'Выезды дня', href: `/reservations?departure=${day.date}` },
    rows: departureDebt.map((r) => bookingRow(r, `К оплате ${formatMoney(r.balanceMinor)}`, 'booking-finance')),
  });
  const arrivalDebt = arrivals.filter((r) => BigInt(r.balanceMinor) > 0n);
  push({
    key: 'arrival-debt',
    severity: 'warning',
    count: arrivalDebt.length,
    text: `${pluralRu(arrivalDebt.length, ['заезд', 'заезда', 'заездов'])} без оплаты`,
    action: { label: 'Заезды дня', href: `/reservations?arrival=${day.date}` },
    rows: arrivalDebt.map((r) => bookingRow(r, `К оплате ${formatMoney(r.balanceMinor)}`, 'booking-finance')),
  });
  if (isToday && board) {
    const dirty = board.rows.filter((r) => r.unit.housekeepingStatus === 'DIRTY').length;
    push({
      key: 'dirty',
      severity: 'warning',
      count: dirty,
      text: `${pluralRu(dirty, ['ячейка требует', 'ячейки требуют', 'ячеек требуют'])} уборки`,
      action: { label: 'Открыть уборку', href: chessboard },
    });
  }
  if (isToday && guard)
    push({
      key: 'incidents',
      severity: 'warning',
      count: guard.open.total - guard.open.critical,
      text: `${pluralRu(guard.open.total - guard.open.critical, ['открытая неисправность', 'открытые неисправности', 'открытых неисправностей'])} системы`,
      action: { label: 'Посмотреть', href: '/incidents' },
    });

  // Info. Без ячейки — уже строкой выше: причина «нет ячейки» стоит первой и прятала бы карточки
  const cards = arrivals.filter((r) => r.unitCode && (r.blockedReason || r.guestsRecorded < r.adults));
  push({
    key: 'cards',
    severity: 'info',
    count: cards.length,
    text: `${pluralRu(cards.length, ['карточка гостя', 'карточки гостей', 'карточек гостей'])} не готовы к заселению`,
    action: { label: 'Заезды дня', href: `/reservations?arrival=${day.date}` },
    rows: cards.map((r) =>
      bookingRow(r, r.blockedReason || `Заполнить карточки: ${r.guestsRecorded} из ${r.adults}`, 'booking-actions'),
    ),
  });

  return events.sort((a, b) => SEVERITY[a.severity].rank - SEVERITY[b.severity].rank);
}

/*
 * Один блок сразу под полосой «На стойке» (A1). Разбивка сверху видна и при нуле (решение владельца 23.09), теперь — по
 * важности: смена видит, что критичного нет, а не одно слово «всё в порядке». День без броней и без событий разбивку
 * не показывает — считать там нечего.
 */
export function DayAttention(props: {
  day: DeskDay;
  board: Chessboard | null;
  guard: GuardStatus | null;
  isToday: boolean;
}) {
  const events = attentionEvents(props);
  const total = events.reduce((n, e) => n + e.count, 0);
  const bySeverity = (s: Severity) => events.filter((e) => e.severity === s).reduce((n, e) => n + e.count, 0);
  const { day } = props;
  const hasDay = day.arrivals.length + day.departures.length + day.inHouse.length > 0 || events.length > 0;
  return (
    <section className="attention-card" id="day-attention" aria-label="Требуют внимания">
      <div className="attention-heading">
        <h2>Требуют внимания</h2>
        <span className="attention-count" data-state={total ? 'on' : 'off'}>
          {total}
        </span>
      </div>
      {hasDay ? (
        <ul className="attention-tally" data-testid="attention-tally">
          {(Object.keys(SEVERITY) as Severity[]).map((s) => (
            <li key={s} data-severity={s} data-state={bySeverity(s) ? 'on' : 'off'}>
              <strong>{bySeverity(s)}</strong>
              <span>{SEVERITY[s].word}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {events.length === 0 ? (
        <div className="attention-empty">
          <Icon name="check" />
          <strong>Всё в порядке</strong>
          <p>Нет просроченных заездов, долгов и незавершённых операций.</p>
        </div>
      ) : (
        <div className="attention-list">
          {events.map((e) => (
            <div
              key={e.key}
              className="attention-event"
              data-testid="attention-event"
              data-event={e.key}
              data-severity={e.severity}
              data-count={e.count}
            >
              <div className="attention-event__head">
                <Badge tone={SEVERITY[e.severity].tone}>{SEVERITY[e.severity].word}</Badge>
                <span className="attention-event__text">{e.text}</span>
                <Link className="card-heading__link" href={e.action.href} data-testid="attention-action">
                  {e.action.label}
                  <Icon name="chevron" width={14} />
                </Link>
              </div>
              {e.rows?.slice(0, ROWS).map((r) => (
                <Link
                  key={r.key}
                  href={r.href}
                  className={`attention-item attention-item--${e.severity}`}
                  data-testid={r.testId}
                >
                  <span className="attention-item__text">
                    <span className="attention-item__head">
                      <strong>{r.name}</strong>
                      <span className="booking-number">{r.number}</span>
                    </span>
                    <small>{r.note}</small>
                  </span>
                  <Icon name="chevron" />
                </Link>
              ))}
              {e.rows && e.rows.length > ROWS ? (
                <span className="attention-event__more">ещё {e.rows.length - ROWS}</span>
              ) : null}
            </div>
          ))}
        </div>
      )}
      <div className="attention-footer">
        <Icon name="clock" /> По данным выбранного дня
      </div>
    </section>
  );
}
