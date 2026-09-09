import Link from 'next/link';
import { unitsApi } from '../../../lib/api';
import { UnitActions } from './unit-actions';

const STATUS_RU: Record<string, string> = {
  TENTATIVE: 'предварительная',
  CONFIRMED: 'подтверждена',
  CHECKED_IN: 'заселён',
  CHECKED_OUT: 'выселен',
  CANCELLED: 'отменена',
  NO_SHOW: 'незаезд',
};

/** Карточка ячейки: уборка, блокировки, ближайшие проживания. */
export default async function UnitPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const unit = await unitsApi.card(decodeURIComponent(code));
  const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px 48px' }}>
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        <Link href="/chessboard">← шахматка</Link>
      </div>
      <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>
        Ячейка {unit.code}{' '}
        <span style={{ color: '#666', fontWeight: 400 }}>
          · {unit.kind === 'BED' ? 'койка' : 'номер'} · {unit.accommodationTypeName}
        </span>
      </h1>
      <div style={{ color: '#666', marginBottom: 18 }}>
        Комната {unit.roomNumber}
        {unit.active ? '' : ' · неактивна'}
      </div>
      <UnitActions unit={unit} today={today} />
      <h2 style={{ fontSize: 16, margin: '20px 0 8px' }}>Ближайшие проживания (60 дней)</h2>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          background: '#fff',
          border: '1px solid #e3e5e8',
          borderRadius: 8,
          fontSize: 14,
        }}
      >
        <thead>
          <tr>
            {['Бронь', 'Заезд', 'Выезд', 'Статус', 'Гость'].map((h) => (
              <th key={h} style={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {unit.stays.length === 0 && (
            <tr>
              <td style={td} colSpan={5}>
                нет
              </td>
            </tr>
          )}
          {unit.stays.map((s) => (
            <tr key={`${s.confirmationNumber}-${s.startDate}`}>
              <td style={td}>
                <Link href={`/reservations/${encodeURIComponent(s.confirmationNumber)}`}>
                  {s.confirmationNumber}
                </Link>
              </td>
              <td style={td}>{s.startDate}</td>
              <td style={td}>{s.endDate}</td>
              <td style={td}>{STATUS_RU[s.status] ?? s.status}</td>
              <td style={td}>{s.guestLabel || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '1px solid #e3e5e8',
  fontSize: 12,
  color: '#666',
};
const td: React.CSSProperties = { padding: '7px 10px', borderBottom: '1px solid #f0f1f3' };
