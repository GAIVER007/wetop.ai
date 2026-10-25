import Link from 'next/link';
import { type Chessboard, type DeskDay, type DeskRow, type GuardStatus } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { pluralRu } from '../../lib/plural';
import { displayDate } from '../../lib/display-date';
import { Icon } from '../../components/icon';
import { Badge, type BadgeTone } from '../../components/ui';
import { msg, translator, type Translate } from '../../i18n';
import { serverT } from '../../i18n/server';

type Severity = 'critical' | 'warning' | 'info';

const SEVERITY: Record<Severity, { word: string; tone: BadgeTone; rank: number }> = {
  critical: { word: msg('Критично'), tone: 'danger', rank: 0 },
  warning: { word: msg('Важно'), tone: 'warn', rank: 1 },
  info: { word: msg('К сведению'), tone: 'neutral', rank: 2 },
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
 * (день стойки, календарь дня, статус сторожа), и только существующие правила: пороги и важность инцидентов — сторожа,
 * «не готово» — уборка ≠ «проверено». С чем человек ничего не может сделать, сюда не попадает: у каждой строки действие.
 * Уборка и инциденты — текущее состояние, поэтому только на сегодня.
 */
function attentionEvents(
  input: {
    day: DeskDay;
    board: Chessboard | null;
    guard: GuardStatus | null;
    isToday: boolean;
  },
  t: Translate = translator('ru'),
): AttentionEvent[] {
  const { day, board, guard, isToday } = input;
  const chessboard = `/chessboard?from=${day.date}&to=${day.date}`;
  const arrivals = day.arrivals.filter(waiting);
  const events: AttentionEvent[] = [];
  const push = (e: AttentionEvent) => {
    if (e.count > 0) events.push(e);
  };
  const bookingRow = (
    r: DeskRow,
    note: string,
    anchor: 'booking-actions' | 'booking-finance',
    testId?: string,
  ) => ({
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
      text: t('{count} системы', { count: pluralRu(guard.open.critical, [t('критичная неисправность'), t('критичные неисправности'), t('критичных неисправностей')]) }),
      action: { label: t('Посмотреть'), href: '/incidents' },
    });
  // Без ячейки: календарь дня знает все такие брони, день стойки — только заезды; имя гостя берём из дня стойки
  const known = new Map(
    [...day.arrivals, ...day.overdueArrivals, ...day.inHouse, ...day.departures].map((r) => [
      r.confirmationNumber,
      r,
    ]),
  );
  const unassigned = board
    ? [
        ...new Map(board.unassigned.map((u) => [u.confirmationNumber, u.categoryName])).entries(),
      ].map(([number, category]) => ({
        number,
        category,
        name: known.get(number)?.guestLabel || number,
      }))
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
    text: t('{count} без номера', { count: pluralRu(unassigned.length, [t('бронь'), t('брони'), t('броней')]) }),
    action: { label: t('Назначить'), href: `${chessboard}#unassigned-stays` },
    rows: unassigned.map((u) => ({
      key: `${u.number}-unassigned`,
      name: u.name,
      number: u.number,
      note: t('{category}, номер не назначен: назначить номер или койку', { category: u.category }),
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
      text: t('{count} сегодня в неготовый номер', { count: pluralRu(notReady.length, [t('заезд'), t('заезда'), t('заездов')]) }),
      action: { label: t('Открыть календарь'), href: chessboard },
      rows: notReady.map((r) =>
        bookingRow(r, t('Номер {unit}: уборка не проверена', { unit: r.unitCode ?? '' }), 'booking-actions'),
      ),
    });
  }

  // Warning
  push({
    key: 'no-show',
    severity: 'warning',
    count: day.overdueArrivals.length,
    text: t('{count} вовремя', { count: pluralRu(day.overdueArrivals.length, [t('гость не заехал'), t('гостя не заехали'), t('гостей не заехали')]) }),
    action: { label: t('Брони с проблемами'), href: '/reservations?view=attention' },
    rows: day.overdueArrivals.map((r) =>
      bookingRow(
        r,
        t('Не заехал {date}: заселить или отметить незаезд', { date: displayDate(r.arrivalDate) }),
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
    text: t('{count} с долгом', { count: pluralRu(departureDebt.length, [t('уезжающий'), t('уезжающих'), t('уезжающих')]) }),
    action: { label: t('Выезды дня'), href: `/reservations?departure=${day.date}` },
    rows: departureDebt.map((r) =>
      bookingRow(r, t('К оплате {sum}', { sum: formatMoney(r.balanceMinor) }), 'booking-finance'),
    ),
  });
  const arrivalDebt = arrivals.filter((r) => BigInt(r.balanceMinor) > 0n);
  push({
    key: 'arrival-debt',
    severity: 'warning',
    count: arrivalDebt.length,
    text: t('{count} без оплаты', { count: pluralRu(arrivalDebt.length, [t('заезд'), t('заезда'), t('заездов')]) }),
    action: { label: t('Заезды дня'), href: `/reservations?arrival=${day.date}` },
    rows: arrivalDebt.map((r) =>
      bookingRow(r, t('К оплате {sum}', { sum: formatMoney(r.balanceMinor) }), 'booking-finance'),
    ),
  });
  if (isToday && board) {
    const dirty = board.rows.filter((r) => r.unit.housekeepingStatus === 'DIRTY').length;
    push({
      key: 'dirty',
      severity: 'warning',
      count: dirty,
      text: t('{count} уборки', { count: pluralRu(dirty, [t('номер требует'), t('номера требуют'), t('номеров требуют')]) }),
      action: { label: t('Открыть уборку'), href: chessboard },
    });
  }
  if (isToday && guard)
    push({
      key: 'incidents',
      severity: 'warning',
      count: guard.open.total - guard.open.critical,
      text: t('{count} системы', { count: pluralRu(guard.open.total - guard.open.critical, [t('открытая неисправность'), t('открытые неисправности'), t('открытых неисправностей')]) }),
      action: { label: t('Посмотреть'), href: '/incidents' },
    });

  // Info. Без ячейки — уже строкой выше: причина «нет ячейки» стоит первой и прятала бы карточки
  const cards = arrivals.filter(
    (r) => r.unitCode && (r.blockedReason || r.guestsRecorded < r.adults),
  );
  push({
    key: 'cards',
    severity: 'info',
    count: cards.length,
    text: t('{count} не готовы к заселению', { count: pluralRu(cards.length, [t('карточка гостя'), t('карточки гостей'), t('карточек гостей')]) }),
    action: { label: t('Заезды дня'), href: `/reservations?arrival=${day.date}` },
    rows: cards.map((r) =>
      bookingRow(
        r,
        r.blockedReason || t('Заполнить карточки: {done} из {total}', { done: r.guestsRecorded, total: r.adults }),
        'booking-actions',
      ),
    ),
  });

  return events.sort((a, b) => SEVERITY[a.severity].rank - SEVERITY[b.severity].rank);
}

/** Число событий совпадает с существующей очередью, включая несколько событий одной брони. */
export function attentionCount(input: Parameters<typeof attentionEvents>[0]): number {
  return attentionEvents(input).reduce((total, event) => total + event.count, 0);
}

/*
 * Один блок сразу под полосой «На стойке» (A1). Разбивка сверху видна и при нуле (решение владельца 23.09), теперь — по
 * важности: смена видит, что критичного нет, а не одно слово «всё в порядке». День без броней и без событий разбивку
 * не показывает — считать там нечего.
 */
export async function DayAttention(props: {
  day: DeskDay;
  board: Chessboard | null;
  guard: GuardStatus | null;
  isToday: boolean;
}) {
  const t = await serverT();
  const events = attentionEvents(props, t);
  const total = events.reduce((n, e) => n + e.count, 0);
  const bySeverity = (s: Severity) =>
    events.filter((e) => e.severity === s).reduce((n, e) => n + e.count, 0);
  const { day } = props;
  const hasDay =
    day.arrivals.length + day.departures.length + day.inHouse.length > 0 || events.length > 0;
  return (
    <section className="attention-card" id="day-attention" aria-label={t('Требуют внимания')}>
      <div className="attention-heading">
        <h2>{t('Требуют внимания')}</h2>
        <span className="attention-count" data-state={total ? 'on' : 'off'}>
          {total}
        </span>
      </div>
      {hasDay ? (
        <ul className="attention-tally" data-testid="attention-tally">
          {(Object.keys(SEVERITY) as Severity[]).map((s) => (
            <li key={s} data-severity={s} data-state={bySeverity(s) ? 'on' : 'off'}>
              <strong>{bySeverity(s)}</strong>
              <span>{t(SEVERITY[s].word)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {events.length === 0 ? (
        <div className="attention-empty">
          <Icon name="check" />
          <strong>{t('Всё в порядке')}</strong>
          <p>{t('Нет просроченных заездов, долгов и незавершённых операций.')}</p>
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
                <Badge tone={SEVERITY[e.severity].tone}>{t(SEVERITY[e.severity].word)}</Badge>
                <span className="attention-event__text">{e.text}</span>
                <Link
                  className="card-heading__link"
                  href={e.action.href}
                  data-testid="attention-action"
                >
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
                <span className="attention-event__more">{t('ещё {n}', { n: e.rows.length - ROWS })}</span>
              ) : null}
            </div>
          ))}
        </div>
      )}
      <div className="attention-footer">
        <Icon name="clock" /> {t('По данным выбранного дня')}
      </div>
    </section>
  );
}
