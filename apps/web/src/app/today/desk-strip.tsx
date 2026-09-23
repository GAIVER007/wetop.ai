import Link from 'next/link';
import type { Chessboard, DeskDay } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { Icon } from '../../components/icon';
import { displayDate } from '../../lib/display-date';

/**
 * Полоса «На стойке»: то, что раньше было пятью карточками «Обзора дня». `data-testid` c-* не менять —
 * их читает сквозная сверка `scripts/reconciliation/src/cli-system-trace.ts` (Exely ↔ Supabase ↔ API ↔ экран).
 *
 * Разбор 23.09.2026: числа дня стоят без цвета статуса — зелёный заездов, жёлтый выездов и синий
 * «свободно» ничего не значили по §9 (жёлтый горел каждый день, даже при нуле выездов); цвет остался
 * только у долга. И «долг уезжающих» из API — это долг тех, кто ещё живёт: гость, выселенный сегодня
 * с долгом, в него не входит, и полоса писала «все счета оплачены» рядом с задачей «К оплате» в
 * «Требуют внимания». Теперь такие гости названы числом и ведут к списку.
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
  const free = board ? String(board.summary[day.date]?.free ?? 0) : '—';
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
          <strong className="desk-stat__value" data-testid="c-inhouse">
            {day.counts.inHouse}
          </strong>
          <span className="desk-stat__hint">активных размещений</span>
        </div>
        <div className="desk-stat">
          <span className="desk-stat__label">Заезды</span>
          <strong className="desk-stat__value" data-testid="c-arrivals">
            {day.counts.arrivals}
          </strong>
          <span className="desk-stat__hint">
            <b data-testid="c-tocheckin">{day.counts.toCheckIn}</b> ожидают заселения
          </span>
        </div>
        <div className="desk-stat">
          <span className="desk-stat__label">Выезды</span>
          <strong className="desk-stat__value" data-testid="c-departures">
            {day.counts.departures}
          </strong>
          <span className="desk-stat__hint">
            <b data-testid="c-tocheckout">{day.counts.toCheckOut}</b> ожидают выезда
          </span>
        </div>
        <div className="desk-stat">
          <span className="desk-stat__label">Свободно</span>
          <strong className="desk-stat__value" data-testid="c-free">
            {free}
          </strong>
          <span className="desk-stat__hint">номеров и койко-мест</span>
        </div>
        <div className={debt ? 'desk-stat desk-stat--debt' : 'desk-stat desk-stat--paid'}>
          <span className="desk-stat__label">Долг уезжающих</span>
          <strong className="desk-stat__value desk-stat__value--money" data-testid="c-debt">
            {formatMoney(day.debtMinor)}
          </strong>
          {debt ? (
            <span className="desk-stat__hint">проверьте расчёт перед выездом</span>
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
