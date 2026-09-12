import Link from 'next/link';
import { chessboardApi, type UnassignedStay } from '../../lib/api';
import { Page } from '../../components/page';
import { Legend, cx } from '../../components/ui';
import { ChessboardGrid } from './board-grid';

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
      subtitle={`${board.from} — ${board.to} · ${board.rows.length} ячеек`}
      actions={
        <>
          <Link href={shift(-board.dates.length)}>← раньше</Link>
          <Link href="/chessboard">сегодня</Link>
          <Link href={shift(board.dates.length)}>позже →</Link>
        </>
      }
    >
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
      <ChessboardGrid board={board} />
      <p className="note">
        Число под датой — занятых ячеек на эту ночь. Ночь выезда не занимает ячейку. Клик по клетке
        открывает бронь. Перетащите клетку на другую строку — бронь переселится в ту ячейку с даты
        взятой клетки (в другую категорию — только на всё проживание). Брони без ячейки на сетке не
        видны — они в списке над сеткой; ячейка назначается с карточки брони.
      </p>
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
    <section
      data-testid="unassigned-stays"
      data-count={stays.length}
      className="panel small"
      style={{ marginBottom: 10, gap: 4 }}
    >
      <div className={cx('bold', stays.length ? 'warn-text' : 'muted')}>
        Без ячейки: {stays.length}
      </div>
      {groups.map((g) => (
        <div key={g.code}>
          <span className="muted-2">{g.name}</span>
          <ul className="list">
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
