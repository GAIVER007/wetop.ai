import Link from 'next/link';
import { reservationDirectory, hotelToday, reservationStatuses } from '../../lib/hotel-api';
import { Icon } from '../../components/icon';
import { EmptyState, StatusBadge, Table } from '../../components/ui';
import { messengerLinks } from '../../lib/api';
import { displayDate } from '../../lib/display-date';
import { nightsBetween, pluralRu } from '../../lib/plural';
export async function GuestDirectory({ status = 'ALL' }: { status?: string }) {
  // Смене нужны все, кто живёт сегодня: на объекте до 92 гостей, а страница в 25 строк обрезала
  // список молча — 25 из ~80, и остальных было не видно (§7.3 плана wetop-domain)
  const data = await reservationDirectory({
    from: hotelToday(),
    to: hotelToday(),
    status,
    pageSize: '200',
  });
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
        <span data-testid="guests-today-count">
          Гости с проживанием на сегодня: {pluralRu(rows.length, ['гость', 'гостя', 'гостей'])}
        </span>
        <Link href="/reservations">Все бронирования</Link>
      </div>
      {/* Одна строка на гостя: имя, как связаться, где живёт, когда, статус, бронь — без email и аватаров */}
      <Table className="dir-table dir-table--guests-today" nowrap>
        <thead>
          <tr>
            <th>Гость</th>
            <th>Телефон</th>
            <th>Место</th>
            <th>Проживание</th>
            <th>Статус</th>
            <th>Бронь</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const nights = nightsBetween(r.arrivalDate, r.departureDate);
            const wa = messengerLinks(r.primaryGuest!.phone);
            return (
              <tr key={r.primaryGuest!.id}>
                <td>
                  <Link
                    className="directory-guest dir-guest"
                    href={`/guests/${encodeURIComponent(r.primaryGuest!.id)}`}
                  >
                    <strong>{r.primaryGuest!.label}</strong>
                  </Link>
                </td>
                <td className="dir-phone">
                  <span>{r.primaryGuest!.phone || '—'}</span>
                  {wa && (
                    <a
                      className="dir-wa"
                      href={wa.whatsapp}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`WhatsApp: ${r.primaryGuest!.label}`}
                    >
                      WA
                    </a>
                  )}
                </td>
                <td>
                  {r.unitCodes.length ? (
                    <span className="dir-unit">
                      <Icon name="bed" />
                      {r.unitCodes.join(', ')}
                    </span>
                  ) : (
                    <span className="warn-text">не назначено</span>
                  )}
                </td>
                <td className="dir-stay">
                  <time dateTime={r.arrivalDate}>{displayDate(r.arrivalDate)}</time>
                  {' → '}
                  <time dateTime={r.departureDate}>{displayDate(r.departureDate)}</time>
                  {nights > 0 && <small>{pluralRu(nights, ['ночь', 'ночи', 'ночей'])}</small>}
                </td>
                <td>
                  <StatusBadge
                    status={r.status}
                    label={reservationStatuses[r.status] || r.status}
                  />
                </td>
                <td>
                  <Link
                    className="dir-number"
                    href={`/reservations/${encodeURIComponent(r.confirmationNumber)}`}
                    aria-label={`Открыть бронь ${r.confirmationNumber}`}
                  >
                    {r.confirmationNumber}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {!rows.length && (
        <EmptyState
          data-testid="guests-today-empty"
          icon={<Icon name="guests" />}
          title="Гостей в этом списке пока нет"
          actions={
            status !== 'ALL' && (
              <Link href="/guests" className="btn btn--secondary">
                Все статусы
              </Link>
            )
          }
        >
          Найдите гостя по имени, телефону или email — поле поиска выше.
        </EmptyState>
      )}
      {data.total > data.pageSize && (
        <p className="muted small" role="status">
          Броней на сегодня {data.total}, показаны гости из первых {data.pageSize}. Остальных ищите
          по имени или телефону.
        </p>
      )}
    </>
  );
}
