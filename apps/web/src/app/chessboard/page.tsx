import Link from 'next/link';
import { chessboardApi, type UnassignedStay } from '../../lib/api';
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
    <main style={{ padding: '20px 20px 48px', maxWidth: '100%' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 16,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ fontSize: 24, margin: 0 }}>Шахматка</h1>
        <span style={{ color: '#666' }}>
          {board.from} — {board.to} · {board.rows.length} ячеек
        </span>
        <nav style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
          <Link href={shift(-board.dates.length)}>← раньше</Link>
          <Link href="/chessboard">сегодня</Link>
          <Link href={shift(board.dates.length)}>позже →</Link>
          <Link href="/today">сегодня</Link>
          <Link href="/inventory">номерной фонд</Link>
          <Link href="/rates">цены</Link>
          <Link href="/channels">каналы</Link>
          <Link href="/guests">гости</Link>
          <Link href="/finance">деньги</Link>
          <Link href="/journal">журнал</Link>
          <Link href="/reservations/new" style={{ fontWeight: 600 }}>
            + новая бронь
          </Link>
        </nav>
      </header>
      <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#555', marginBottom: 10 }}>
        <Legend color="#dbeafe" label="подтверждена" />
        <Legend color="#bbf7d0" label="заселён" />
        <Legend color="#e5e7eb" label="выселен" />
        <Legend color="#fde68a" label="предварительная" />
        <Legend color="#fecaca" label="блокировка" />
      </div>
      <UnassignedStays stays={board.unassigned ?? []} />
      <ChessboardGrid board={board} />
      <p style={{ color: '#666', fontSize: 12, marginTop: 10 }}>
        Число под датой — занятых ячеек на эту ночь. Ночь выезда не занимает ячейку. Клик по клетке
        открывает бронь. Перетащите клетку на другую строку — бронь переселится в ту ячейку с даты
        взятой клетки (в другую категорию — только на всё проживание). Брони без ячейки на сетке не
        видны — они в списке над сеткой; ячейка назначается с карточки брони.
      </p>
    </main>
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
      style={{
        background: '#fff',
        border: '1px solid #e3e5e8',
        borderRadius: 8,
        padding: '8px 12px',
        marginBottom: 10,
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 600, color: stays.length ? '#b45309' : '#555' }}>
        Без ячейки: {stays.length}
      </div>
      {groups.map((g) => (
        <div key={g.code} style={{ marginTop: 6 }}>
          <span style={{ color: '#777' }}>{g.name}</span>
          <ul style={{ margin: '2px 0 0', paddingLeft: 18 }}>
            {g.items.map((s) => (
              <li
                key={`${s.confirmationNumber}-${s.arrivalDate}`}
                data-testid="unassigned-stay"
                data-number={s.confirmationNumber}
                style={{ lineHeight: '20px' }}
              >
                <Link
                  href={`/reservations/${encodeURIComponent(s.confirmationNumber)}`}
                  style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 600 }}
                >
                  {s.confirmationNumber}
                </Link>
                <span style={{ color: '#555', marginLeft: 8 }}>
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

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span>
      <span
        style={{
          display: 'inline-block',
          width: 12,
          height: 12,
          background: color,
          borderRadius: 3,
          marginRight: 4,
          verticalAlign: -1,
        }}
      />
      {label}
    </span>
  );
}
