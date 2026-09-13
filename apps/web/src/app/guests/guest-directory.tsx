import Link from 'next/link';
import { reservationDirectory, hotelToday, reservationStatuses } from '../../lib/hotel-api';
import { Icon } from '../../components/icon';
import { StatusBadge, Table } from '../../components/ui';
export async function GuestDirectory({ status = 'ALL' }: { status?: string }) {
  const data = await reservationDirectory({ from: hotelToday(), to: hotelToday(), status });
  const rows = [
    ...new Map(
      data.rows.filter((r) => r.primaryGuest).map((r) => [r.primaryGuest!.id, r]),
    ).values(),
  ];
  return (
    <>
      <nav className="directory-filters" aria-label="Гости по статусу">
        {[
          ['ALL', 'Все'],
          ['CHECKED_IN', 'Проживают'],
          ['CONFIRMED', 'Ожидаются'],
          ['CHECKED_OUT', 'Выехали'],
        ].map(([id, label]) => (
          <Link key={id} className={status === id ? 'is-active' : ''} href={`/guests?status=${id}`}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="directory-meta">
        <span>Гости с проживанием на сегодня</span>
        <Link href="/reservations">Все бронирования →</Link>
      </div>
      <Table>
        <thead>
          <tr>
            {['Гость', 'Телефон', 'Email', 'Номер', 'Статус', 'Заезд', 'Выезд', 'Бронирование'].map(
              (h) => (
                <th key={h}>{h}</th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.primaryGuest!.id}>
              <td>
                <Link
                  className="directory-guest"
                  href={`/guests/${encodeURIComponent(r.primaryGuest!.id)}`}
                >
                  <span className="guest-initials">
                    {r
                      .primaryGuest!.label.split(' ')
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join('')}
                  </span>
                  <strong>{r.primaryGuest!.label}</strong>
                </Link>
              </td>
              <td>{r.primaryGuest!.phone || '—'}</td>
              <td>{r.primaryGuest!.email || '—'}</td>
              <td>{r.unitCodes.join(', ') || '—'}</td>
              <td>
                <StatusBadge status={r.status} label={reservationStatuses[r.status] || r.status} />
              </td>
              <td>{r.arrivalDate}</td>
              <td>{r.departureDate}</td>
              <td>
                <Link href={`/reservations/${encodeURIComponent(r.confirmationNumber)}`}>
                  {r.confirmationNumber}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {!rows.length && (
        <div className="empty-state">
          <Icon name="guests" />
          <h3>Гостей в этом списке пока нет</h3>
          <p>Найдите гостя по имени, телефону или email.</p>
        </div>
      )}
      {data.total > data.pageSize && (
        <p className="muted small">
          Показаны гости из последних {data.pageSize} броней. Для остальных используйте поиск.
        </p>
      )}
    </>
  );
}
