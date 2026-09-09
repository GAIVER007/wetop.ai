import Link from 'next/link';
import { getJsonPublic } from '../../lib/api';

interface AuditRow {
  id: string;
  at: string;
  entityType: string;
  entityId: string;
  action: string;
  subject: string | null;
}
const ACTION_RU: Record<string, string> = {
  'reservation.create': 'бронь создана',
  'reservation.changeDates': 'даты изменены',
  'reservation.cancel': 'бронь отменена',
  'reservation.assign': 'ячейка назначена / переселение',
  'reservation.checkIn': 'заселение',
  'reservation.checkOut': 'выезд',
  'reservation.noShow': 'незаезд',
  'channex.booking.new': 'бронь из канала',
  'channex.booking.modified': 'бронь из канала изменена',
  'channex.booking.cancelled': 'бронь из канала отменена',
  'channex.setup': 'Channex: объект и категории',
  'channex.fullSync': 'Channex: полная выгрузка',
  'rates.bulk': 'цены / ограничения изменены',
  'unit.block': 'ячейка заблокирована',
  'unit.unblock': 'блокировка снята',
  'unit.housekeeping': 'статус уборки',
  'guest.update': 'карточка гостя изменена',
  'guest.document.add': 'документ гостя добавлен',
  'guest.document.delete': 'документ гостя удалён',
  'reservations.import': 'импорт броней из Exely',
};

/** Журнал действий администратора и интеграций (SECURITY §6). Без ПД. */
export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const rows = await getJsonPublic<AuditRow[]>(
    `/audit?limit=200${type ? `&entityType=${encodeURIComponent(type)}` : ''}`,
  );
  return (
    <main style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 20px 48px' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 12 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Журнал действий</h1>
        <nav style={{ display: 'flex', gap: 10, marginLeft: 'auto', fontSize: 14 }}>
          <Link href="/journal">все</Link>
          <Link href="/journal?type=Reservation">брони</Link>
          <Link href="/journal?type=InventoryUnit">ячейки</Link>
          <Link href="/journal?type=Guest">гости</Link>
          <Link href="/journal?type=Property">объект и каналы</Link>
          <Link href="/chessboard">шахматка</Link>
        </nav>
      </header>
      <table
        data-testid="journal-table"
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          background: '#fff',
          border: '1px solid #e3e5e8',
          borderRadius: 8,
          fontSize: 13,
        }}
      >
        <thead>
          <tr>
            {['Когда (Алматы)', 'Действие', 'Объект', 'Что'].map((h) => (
              <th key={h} style={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} data-testid="journal-row">
              <td style={td}>
                {new Date(Date.parse(r.at) + 5 * 3600 * 1000)
                  .toISOString()
                  .slice(0, 16)
                  .replace('T', ' ')}
              </td>
              <td style={td}>{ACTION_RU[r.action] ?? r.action}</td>
              <td style={td}>{r.entityType}</td>
              <td style={td}>
                {r.subject && r.entityType === 'Reservation' ? (
                  <Link href={`/reservations/${encodeURIComponent(r.subject)}`}>{r.subject}</Link>
                ) : (
                  (r.subject ?? <span style={{ color: '#999' }}>{r.entityId.slice(0, 8)}…</span>)
                )}
              </td>
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
const td: React.CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid #f0f1f3',
  whiteSpace: 'nowrap',
};
