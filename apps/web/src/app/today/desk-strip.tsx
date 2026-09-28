import Link from 'next/link';
import type { Chessboard, DeskDay } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { Icon } from '../../components/icon';
import { displayDate } from '../../lib/display-date';

/**
 * Полоса «На стойке» — операционный ряд Главной (A1, ADR-103): проживают, заезды, выезды,
 * свободно, загрузка, к оплате. `data-testid` c-* не менять — их читает сквозная сверка
 * `scripts/reconciliation/src/cli-system-trace.ts` (база ↔ API ↔ экран).
 *
 * Число каждой плитки — ссылка в раздел с этим списком (ТЗ §4): новых фильтров и расчётов A1 не
 * добавляет. «Загрузка» — то же деление, что метр «Статистики»: занято / весь фонд дня, включая
 * блокировки; считается из уже загруженной шахматки. «К оплате» — прежний `debtMinor` (долг
 * уезжающих, которые ещё живут); выехавшие и не заехавшие с остатком названы отдельными ссылками,
 * как раньше (разбор 23.09.2026). Цвет — только у долга (§9).
 */
export function DeskStrip({
  day,
  board,
  today,
}: {
  day: DeskDay;
  board: Chessboard | null;
  today: string;
}) {
  const debt = BigInt(day.debtMinor) > 0n;
  // Уезжающие сегодня с остатком, которых число долга не считает: уже выселенные и так и не заехавшие
  const outside = day.departures.filter(
    (r) => r.status !== 'CHECKED_IN' && BigInt(r.balanceMinor) > 0n,
  );
  const left = outside.filter((r) => r.status === 'CHECKED_OUT').length;
  const notArrived = outside.length - left;
  const summary = board?.summary[day.date];
  const free = summary ? String(summary.free) : '—';
  // Загрузка дня: занято / (занято + свободно + заблокировано) — как метр на /management/statistics
  const units = summary ? summary.occupied + summary.free + summary.blocked : 0;
  const occupancy = summary && units > 0 ? Math.round((summary.occupied / units) * 100) : null;
  const d = day.date;
  const value = (testId: string, text: string, href: string, name: string, money = false) => (
    <Link className="desk-stat__link" href={href} aria-label={name}>
      <strong
        className={money ? 'desk-stat__value desk-stat__value--money' : 'desk-stat__value'}
        data-testid={testId}
      >
        {text}
      </strong>
    </Link>
  );
  return (
    <section className="desk-strip" aria-label="Сегодня на стойке">
      <div className="desk-strip__head">
        <h2>
          <Icon name="today" width={16} height={16} />
          На стойке
          <time className="desk-strip__date" dateTime={day.date}>
            {displayDate(day.date, 'full')}
          </time>
          {day.date === today && <span className="desk-strip__now">сейчас</span>}
        </h2>
        <div className="desk-strip__links">
          <Link href={`/reservations?date=${day.date}`}>Все брони дня</Link>
          <Link href={`/chessboard?from=${day.date}&to=${day.date}`}>Шахматка</Link>
        </div>
      </div>
      <div className="desk-strip__stats">
        <div className="desk-stat">
          <span className="desk-stat__label">Проживают</span>
          {value('c-inhouse', String(day.counts.inHouse), `/reservations?date=${d}`, 'Проживают — брони дня')}
          <span className="desk-stat__hint">активных размещений</span>
        </div>
        <div className="desk-stat">
          <span className="desk-stat__label">Заезды</span>
          {value('c-arrivals', String(day.counts.arrivals), `/reservations?date=${d}`, 'Заезды — брони дня')}
          <span className="desk-stat__hint">
            <b data-testid="c-tocheckin">{day.counts.toCheckIn}</b> ожидают заселения
          </span>
        </div>
        <div className="desk-stat">
          <span className="desk-stat__label">Выезды</span>
          {value('c-departures', String(day.counts.departures), `/reservations?date=${d}`, 'Выезды — брони дня')}
          <span className="desk-stat__hint">
            <b data-testid="c-tocheckout">{day.counts.toCheckOut}</b> ожидают выезда
          </span>
        </div>
        <div className="desk-stat">
          <span className="desk-stat__label">Свободно</span>
          {value('c-free', free, `/chessboard?from=${d}&to=${d}`, 'Свободно — шахматка дня')}
          <span className="desk-stat__hint">номеров и койко-мест</span>
        </div>
        <div className="desk-stat">
          <span className="desk-stat__label">Загрузка</span>
          {value(
            'c-occupancy',
            occupancy === null ? '—' : `${occupancy}%`,
            `/management/statistics?date=${d}`,
            'Загрузка — статистика дня',
          )}
          <span className="desk-stat__hint">
            {summary ? `занято ${summary.occupied} из ${units}` : 'шахматка не загрузилась'}
          </span>
        </div>
        <div className={debt ? 'desk-stat desk-stat--debt' : 'desk-stat desk-stat--paid'}>
          <span className="desk-stat__label">К оплате</span>
          {value(
            'c-debt',
            formatMoney(day.debtMinor),
            `/finance?from=${d}&to=${d}`,
            'К оплате — деньги за день',
            true,
          )}
          {debt ? (
            <span className="desk-stat__hint">долг уезжающих — проверьте расчёт перед выездом</span>
          ) : outside.length === 0 ? (
            <span className="desk-stat__hint desk-stat__hint--ok">все счета оплачены</span>
          ) : null}
          {left > 0 && (
            <a className="desk-stat__hint desk-stat__hint--warn" href="#day-attention">
              выехавших с долгом: {left}
            </a>
          )}
          {notArrived > 0 && (
            <a className="desk-stat__hint desk-stat__hint--warn" href="#day-attention">
              не заехавших с долгом: {notArrived}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
