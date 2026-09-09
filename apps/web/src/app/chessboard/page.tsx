import Link from 'next/link';
import { chessboardApi, type ChessboardCell } from '../../lib/api';

/** Slice 2, шаг 2.7: шахматка только для чтения — 88 ячеек × даты. */
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
  const weekday = (d: string) =>
    ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'][new Date(`${d}T00:00:00Z`).getUTCDay()];

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
          <Link href="/inventory">номерной фонд</Link>
          <Link href="/rates">цены</Link>
          <Link href="/channels">каналы</Link>
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
      <div
        style={{
          overflowX: 'auto',
          background: '#fff',
          border: '1px solid #e3e5e8',
          borderRadius: 8,
        }}
      >
        <table
          data-testid="chessboard"
          style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 12, minWidth: 700 }}
        >
          <thead>
            <tr>
              <th
                style={{
                  ...th,
                  position: 'sticky',
                  left: 0,
                  zIndex: 2,
                  background: '#f9fafb',
                  minWidth: 190,
                  textAlign: 'left',
                }}
              >
                Ячейка
              </th>
              {board.dates.map((d) => (
                <th key={d} style={th} data-testid="date-col">
                  <div>
                    {d.slice(8)}.{d.slice(5, 7)}
                  </div>
                  <div style={{ fontWeight: 400, color: '#888' }}>{weekday(d)}</div>
                  <div data-testid={`occupied-${d}`} style={{ fontWeight: 600, color: '#111' }}>
                    {board.summary[d]!.occupied}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {board.rows.map((row) => (
              <tr key={row.unit.id} data-testid="unit-row">
                <td
                  style={{
                    ...td,
                    position: 'sticky',
                    left: 0,
                    background: '#fff',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 600 }}>
                    {row.unit.code}
                  </span>
                  <span style={{ color: '#777', marginLeft: 8 }}>
                    {row.unit.kind === 'BED' ? 'койка' : 'номер'} · {row.unit.accommodationTypeName}
                  </span>
                </td>
                {row.cells.map((c) => (
                  <Cell key={c.date} cell={c} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ color: '#666', fontSize: 12, marginTop: 10 }}>
        Число под датой — занятых ячеек на эту ночь. Ночь выезда не занимает ячейку. Клик по клетке
        открывает бронь.
      </p>
    </main>
  );
}

function Cell({ cell }: { cell: ChessboardCell }) {
  const bg =
    cell.state === 'BLOCKED'
      ? '#fecaca'
      : cell.state === 'FREE'
        ? '#fff'
        : (STATUS_BG[cell.itemStatus ?? ''] ?? '#dbeafe');
  const title =
    cell.state === 'OCCUPIED'
      ? `${cell.confirmationNumber} · ${cell.guestLabel} · ${cell.itemStatus}`
      : cell.state === 'BLOCKED'
        ? `блок: ${cell.blockType}`
        : '';
  const radius = `${cell.isArrival ? 8 : 0}px ${cell.isLastNight ? 8 : 0}px ${cell.isLastNight ? 8 : 0}px ${cell.isArrival ? 8 : 0}px`;
  return (
    <td style={{ ...td, padding: 2, minWidth: 44 }} data-state={cell.state} title={title}>
      {cell.state === 'OCCUPIED' ? (
        <Link
          href={`/reservations/${encodeURIComponent(cell.confirmationNumber!)}`}
          style={{
            display: 'block',
            background: bg,
            borderRadius: radius,
            height: 22,
            lineHeight: '22px',
            paddingLeft: cell.isArrival ? 6 : 2,
            color: '#111',
            textDecoration: 'none',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            fontSize: 11,
          }}
        >
          {cell.isArrival ? cell.guestLabel : ''}
        </Link>
      ) : (
        <div style={{ background: bg, height: 22, borderRadius: 4 }} />
      )}
    </td>
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
const STATUS_BG: Record<string, string> = {
  CONFIRMED: '#dbeafe',
  CHECKED_IN: '#bbf7d0',
  CHECKED_OUT: '#e5e7eb',
  TENTATIVE: '#fde68a',
};
const th: React.CSSProperties = {
  padding: '6px 4px',
  borderBottom: '1px solid #e3e5e8',
  fontSize: 11,
  color: '#555',
  textAlign: 'center',
  background: '#f9fafb',
};
const td: React.CSSProperties = { padding: '3px 6px', borderBottom: '1px solid #f0f1f3' };
