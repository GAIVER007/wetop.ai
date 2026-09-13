import Link from 'next/link';
import { chessboardApi, type UnassignedStay } from '../../lib/api';
import { Page } from '../../components/page';
import { Button, Input, Legend, cx } from '../../components/ui';
import { ChessboardGrid } from './board-grid';
import { displayDate } from '../../lib/display-date';
import { Icon } from '../../components/icon';

const STATUS_RU: Record<string, string> = {
  TENTATIVE: 'предварительная',
  CONFIRMED: 'подтверждена',
  CHECKED_IN: 'заселён',
  CHECKED_OUT: 'выселен',
  CANCELLED: 'отменена',
  NO_SHOW: 'незаезд',
};

/**
 * Slice 2, шаг 2.7: шахматка — 88 ячеек × даты. Страница остаётся server component; сетка вынесена
 * в клиентский компонент ради перетаскивания брони между ячейками (переселение).
 */
export default async function ChessboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const board = await chessboardApi.board(from, to);
  const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
  /** Окно на N суток от сегодня — смена смотрит вперёд на неделю, две или месяц */
  const window = (days: number) => {
    const t = new Date(`${today}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() + days - 1);
    return `/chessboard?from=${today}&to=${t.toISOString().slice(0, 10)}`;
  };
  const shift = (days: number) => {
    const f = new Date(`${board.from}T00:00:00Z`);
    f.setUTCDate(f.getUTCDate() + days);
    const t = new Date(`${board.to}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() + days);
    return `/chessboard?from=${f.toISOString().slice(0, 10)}&to=${t.toISOString().slice(0, 10)}`;
  };

  return (
    <Page
      width="full"
      title="Шахматка"
      subtitle={`${displayDate(board.from)} — ${displayDate(board.to)} · Номера и койки · ${board.rows.length} мест`}
      actions={
        <div className="board-period">
          <Link className="btn" href="/reservations/new">
            <Icon name="plus" />
            Новая бронь
          </Link>
          <span className="seg">
            <Link href={window(7)} className={cx(board.dates.length === 7 && 'is-on')}>
              7 дней
            </Link>
            <Link href={window(14)} className={cx(board.dates.length === 14 && 'is-on')}>
              14
            </Link>
            <Link href={window(30)} className={cx(board.dates.length === 30 && 'is-on')}>
              30
            </Link>
          </span>
          <span className="board-date-nav">
            <Link
              href={shift(-board.dates.length)}
              className="icon-button"
              aria-label="Предыдущий период"
            >
              <Icon name="chevron" className="rotate-left" />
            </Link>
            <Link href="/chessboard" className="btn btn--secondary">
              Сегодня
            </Link>
            <Link
              href={shift(board.dates.length)}
              className="icon-button"
              aria-label="Следующий период"
            >
              <Icon name="chevron" />
            </Link>
          </span>
        </div>
      }
    >
      <form method="get" className="board-range-form">
        <label className="field field--inline">
          Период
          <Input type="date" name="from" defaultValue={board.from} aria-label="Шахматка: с" />
        </label>
        <span className="muted">—</span>
        <Input type="date" name="to" defaultValue={board.to} aria-label="Шахматка: по" />
        <Button tone="secondary" type="submit">
          Применить
        </Button>
        <span className="muted small">Статусы фильтруются на {displayDate(board.from)}</span>
      </form>
      <Legend
        items={[
          { color: 'var(--st-confirmed)', label: 'подтверждена' },
          { color: 'var(--st-checked-in)', label: 'заселён' },
          { color: 'var(--st-checked-out)', label: 'выселен' },
          { color: 'var(--st-tentative)', label: 'предварительная' },
          { color: 'var(--st-blocked)', label: 'блокировка' },
        ]}
      />
      <UnassignedStays stays={board.unassigned ?? []} />
      <ChessboardGrid board={board} today={today} />
      <details className="board-help">
        <summary>Как работать с шахматкой</summary>
        <p className="note">
          В строке категории — сколько мест свободно на эту ночь, под датой в шапке — сколько занято
          из {board.rows.length}. Ночь выезда ячейку не занимает. Клик по занятой клетке открывает
          бронь, по пустой — форму новой брони на эту дату. Перетащите клетку на другую строку —
          бронь переселится в ту ячейку с даты взятой клетки (в другую категорию — только на всё
          проживание). Брони без ячейки на сетке не видны — они в списке над сеткой; ячейка
          назначается с карточки брони.
        </p>
      </details>
    </Page>
  );
}

/**
 * Строка «Без ячейки» — как «Без номера» в шахматке Exely: проживания в диапазоне доски, у которых
 * нет назначения (бронь канала, которой не хватило места — Q-107, или снятое назначение). Список
 * приходит отсортированным по категории и заезду, здесь только группируется. Гостей не показываем.
 */
function UnassignedStays({ stays }: { stays: UnassignedStay[] }) {
  const groups: Array<{ code: string; name: string; items: UnassignedStay[] }> = [];
  for (const s of stays) {
    const last = groups[groups.length - 1];
    if (last && last.code === s.categoryCode) last.items.push(s);
    else groups.push({ code: s.categoryCode, name: s.categoryName, items: [s] });
  }
  return (
    <section data-testid="unassigned-stays" data-count={stays.length} className="board-unassigned">
      <div className={cx('board-unassigned-title', stays.length ? 'warn-text' : 'muted')}>
        <Icon name={stays.length ? 'incidents' : 'check'} /> Без ячейки: {stays.length}
      </div>
      {groups.map((g) => (
        <div key={g.code}>
          <span className="muted-2">{g.name}</span>
          <ul className="board-unassigned-list">
            {g.items.map((s) => (
              <li
                key={`${s.confirmationNumber}-${s.arrivalDate}`}
                data-testid="unassigned-stay"
                data-number={s.confirmationNumber}
                style={{ lineHeight: '20px' }}
              >
                <Link
                  href={`/reservations/${encodeURIComponent(s.confirmationNumber)}`}
                  className="mono bold"
                >
                  {s.confirmationNumber}
                </Link>{' '}
                <span className="muted">
                  {s.arrivalDate} → {s.departureDate} · {STATUS_RU[s.status] ?? s.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
