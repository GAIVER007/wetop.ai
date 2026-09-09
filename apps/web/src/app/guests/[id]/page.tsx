import Link from 'next/link';
import { guestsApi } from '../../../lib/api';
import { GuestForms } from './guest-forms';

const STATUS_RU: Record<string, string> = {
  TENTATIVE: 'предварительная',
  CONFIRMED: 'подтверждена',
  CHECKED_IN: 'заселён',
  CHECKED_OUT: 'выселен',
  CANCELLED: 'отменена',
  NO_SHOW: 'незаезд',
};

/** Карточка гостя: профиль, документы (маска), история проживаний. */
export default async function GuestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guestsApi.card(id);
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px 48px' }}>
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        <Link href="/guests">← гости</Link> · <Link href="/chessboard">шахматка</Link>
      </div>
      <h1 style={{ fontSize: 22, margin: '0 0 12px' }}>
        {g.lastName} {g.firstName} {g.middleName ?? ''}
      </h1>
      <GuestForms guest={g} />
      <h2 style={{ fontSize: 16, margin: '20px 0 8px' }}>История проживаний</h2>
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
            {['Бронь', 'Категория', 'Ячейка', 'Заезд', 'Выезд', 'Статус'].map((h) => (
              <th key={h} style={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {g.stays.map((s) => (
            <tr key={`${s.confirmationNumber}-${s.arrivalDate}`}>
              <td style={td}>
                <Link href={`/reservations/${encodeURIComponent(s.confirmationNumber)}`}>
                  {s.confirmationNumber}
                </Link>
              </td>
              <td style={td}>{s.accommodationTypeName}</td>
              <td style={td}>{s.unitCode ?? '—'}</td>
              <td style={td}>{s.arrivalDate}</td>
              <td style={td}>{s.departureDate}</td>
              <td style={td}>{STATUS_RU[s.status] ?? s.status}</td>
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
