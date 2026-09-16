import Link from 'next/link';
import type { Chessboard, DeskDay } from '../../lib/api';
import { formatMinor } from '../../lib/api';
import { Icon } from '../../components/icon';
import { displayDate } from '../../lib/display-date';

/**
 * Полоса «На стойке»: то, что раньше было пятью карточками «Обзора дня». `data-testid` c-* не менять —
 * их читает сквозная сверка `scripts/reconciliation/src/cli-system-trace.ts` (Exely ↔ Supabase ↔ API ↔ экран).
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
  const free = board ? String(board.summary[day.date]?.free ?? 0) : '—';
  return (
    <section className="desk-strip" aria-label="Сегодня на стойке">
      <div className="desk-strip__head">
        <h2>
          <Icon name="today" width={16} height={16} />
          На стойке · {displayDate(day.date, 'full')}
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
        <div className="desk-stat desk-stat--arrival">
          <span className="desk-stat__label">Заезды</span>
          <strong className="desk-stat__value" data-testid="c-arrivals">
            {day.counts.arrivals}
          </strong>
          <span className="desk-stat__hint">
            <b data-testid="c-tocheckin">{day.counts.toCheckIn}</b> ожидают заселения
          </span>
        </div>
        <div className="desk-stat desk-stat--departure">
          <span className="desk-stat__label">Выезды</span>
          <strong className="desk-stat__value" data-testid="c-departures">
            {day.counts.departures}
          </strong>
          <span className="desk-stat__hint">
            <b data-testid="c-tocheckout">{day.counts.toCheckOut}</b> ожидают выезда
          </span>
        </div>
        <div className="desk-stat desk-stat--free">
          <span className="desk-stat__label">Свободно</span>
          <strong className="desk-stat__value" data-testid="c-free">
            {free}
          </strong>
          <span className="desk-stat__hint">номеров и койко-мест</span>
        </div>
        <div className={debt ? 'desk-stat desk-stat--debt' : 'desk-stat desk-stat--paid'}>
          <span className="desk-stat__label">Долг уезжающих</span>
          <strong className="desk-stat__value desk-stat__value--money" data-testid="c-debt">
            {formatMinor(day.debtMinor)}
          </strong>
          <span className="desk-stat__hint">
            {debt ? 'проверьте расчёт перед выездом' : 'все счета оплачены'}
          </span>
        </div>
      </div>
    </section>
  );
}
