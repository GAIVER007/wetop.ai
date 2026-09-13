import Link from 'next/link';
import { Page } from '../../components/page';
import { Icon } from '../../components/icon';
import { Alert, Button, Input, StatusBadge, Table } from '../../components/ui';
import { formatMinor } from '../../lib/api';
import {
  hotelToday,
  reservationDirectory,
  validDate,
  sourceNames,
  reservationStatuses,
} from '../../lib/hotel-api';
export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    date?: string;
    status?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const from = sp.from || sp.date || hotelToday(),
    to = sp.to || from,
    status = sp.status || 'ALL',
    q = sp.q || '';
  const valid =
    validDate(from) &&
    validDate(to) &&
    from <= to &&
    Date.parse(to) - Date.parse(from) <= 365 * 86400000;
  const result = valid
    ? await reservationDirectory({ from, to, status, q, page: sp.page || '1' })
    : null;
  const href = (values: Record<string, string>) =>
    `/reservations?${new URLSearchParams({ from, to, status, q, ...values })}`;
  return (
    <Page
      title="Брони"
      subtitle="Бронирования и проживания в выбранном периоде"
      actions={
        <Link href="/reservations/new" className="btn">
          <Icon name="plus" />
          Новая бронь
        </Link>
      }
    >
      <form className="directory-toolbar" method="get">
        <div className="search-field">
          <Icon name="search" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Гость, телефон или номер брони"
            aria-label="Поиск броней"
          />
        </div>
        <Input type="date" name="from" defaultValue={from} aria-label="Брони: с" />
        <span className="muted">—</span>
        <Input type="date" name="to" defaultValue={to} aria-label="Брони: по" />
        <input type="hidden" name="status" value={status} />
        <Button tone="secondary">Показать</Button>
      </form>
      <nav className="directory-filters" aria-label="Статусы броней">
        {Object.entries(reservationStatuses).map(([id, label]) => (
          <Link
            key={id}
            href={href({ status: id, page: '1' })}
            className={status === id ? 'is-active' : ''}
          >
            {label}
          </Link>
        ))}
      </nav>
      {!valid && <Alert boxed>Выберите корректный период до 366 дней.</Alert>}
      {result && (
        <>
          <div className="directory-meta">
            <span>{result.total} бронирований</span>
            <span>
              {from} — {to}
            </span>
          </div>
          <Table data-testid="reservations-table">
            <thead>
              <tr>
                {[
                  'Бронь / гость',
                  'Источник',
                  'Номер',
                  'Заезд',
                  'Выезд',
                  'Статус',
                  'Стоимость',
                  'Оплачено',
                  'К оплате',
                  '',
                ].map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.confirmationNumber}>
                  <td>
                    <Link
                      className="directory-guest"
                      href={`/reservations/${encodeURIComponent(r.confirmationNumber)}`}
                    >
                      <span className="guest-initials">
                        {r.primaryGuest?.label
                          .split(' ')
                          .slice(0, 2)
                          .map((n) => n[0])
                          .join('') || 'Г'}
                      </span>
                      <span>
                        <strong>{r.primaryGuest?.label || 'Гость без имени'}</strong>
                        <small>{r.confirmationNumber}</small>
                      </span>
                    </Link>
                  </td>
                  <td>
                    <span className="source-tag">
                      {r.channel || sourceNames[r.source] || r.source}
                    </span>
                  </td>
                  <td>{r.unitCodes.join(', ') || 'Не назначен'}</td>
                  <td className="nowrap">{r.arrivalDate}</td>
                  <td className="nowrap">{r.departureDate}</td>
                  <td>
                    <StatusBadge
                      status={r.status}
                      label={reservationStatuses[r.status] || r.status}
                    />
                  </td>
                  <td className="num nowrap">{formatMinor(r.totalAmountMinor, r.currency)}</td>
                  <td className="num nowrap">
                    {r.hasFolios ? formatMinor(r.paidMinor, r.currency) : '—'}
                  </td>
                  <td className="num nowrap">
                    <span className={BigInt(r.balanceMinor) > 0n ? 'danger-text' : ''}>
                      {r.hasFolios ? formatMinor(r.balanceMinor, r.currency) : '—'}
                    </span>
                  </td>
                  <td>
                    <Link
                      className="icon-button"
                      href={`/reservations/${encodeURIComponent(r.confirmationNumber)}`}
                      aria-label={`Открыть бронь ${r.confirmationNumber}`}
                    >
                      <Icon name="chevron" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          {!result.rows.length && (
            <div className="empty-state">
              <Icon name="booking" />
              <h3>Бронирований не найдено</h3>
              <p>Измените период или условия поиска.</p>
              <Link href="/reservations" className="btn btn--secondary">
                Сбросить фильтры
              </Link>
            </div>
          )}
          <nav className="pagination" aria-label="Страницы броней">
            {result.page > 1 && (
              <Link className="btn btn--secondary" href={href({ page: String(result.page - 1) })}>
                Назад
              </Link>
            )}
            <span>
              Страница {result.page} из {Math.max(1, Math.ceil(result.total / result.pageSize))}
            </span>
            {result.page * result.pageSize < result.total && (
              <Link className="btn btn--secondary" href={href({ page: String(result.page + 1) })}>
                Далее
              </Link>
            )}
          </nav>
        </>
      )}
    </Page>
  );
}
