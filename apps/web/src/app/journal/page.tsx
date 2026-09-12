import Link from 'next/link';
import { getJsonPublic } from '../../lib/api';
import { Page } from '../../components/page';
import { Table } from '../../components/ui';

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
  'analytics.site.create': 'сайт со счётчиком добавлен',
  'analytics.site.update': 'сайт со счётчиком изменён',
  'analytics.site.delete': 'сайт со счётчиком удалён',
};
const FILTERS: ReadonlyArray<readonly [type: string | null, label: string]> = [
  [null, 'все'],
  ['Reservation', 'брони'],
  ['InventoryUnit', 'ячейки'],
  ['Guest', 'гости'],
  ['Property', 'объект и каналы'],
  ['TrackedSite', 'сайт'],
];

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
    <Page
      title="Журнал действий"
      actions={FILTERS.map(([t, label]) => (
        <Link
          key={label}
          href={t ? `/journal?type=${t}` : '/journal'}
          className={(t ?? undefined) === type ? 'bold' : undefined}
        >
          {label}
        </Link>
      ))}
    >
      <Table size="sm" nowrap data-testid="journal-table">
        <thead>
          <tr>
            {['Когда (Алматы)', 'Действие', 'Объект', 'Что'].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} data-testid="journal-row">
              <td>
                {new Date(Date.parse(r.at) + 5 * 3600 * 1000)
                  .toISOString()
                  .slice(0, 16)
                  .replace('T', ' ')}
              </td>
              <td>{ACTION_RU[r.action] ?? r.action}</td>
              <td>{r.entityType}</td>
              <td>
                {r.subject && r.entityType === 'Reservation' ? (
                  <Link href={`/reservations/${encodeURIComponent(r.subject)}`}>{r.subject}</Link>
                ) : (
                  (r.subject ?? <span className="muted-2">{r.entityId.slice(0, 8)}…</span>)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Page>
  );
}
