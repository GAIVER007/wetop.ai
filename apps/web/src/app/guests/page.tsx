import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import Link from 'next/link';
import { reservationStatuses } from '../../lib/hotel-api';
import { GuestDirectory } from './guest-directory';
import { Icon } from '../../components/icon';
import { guestsApi } from '../../lib/api';
import { Page } from '../../components/page';
import { Alert, Button, Input, Table } from '../../components/ui';

/** Поиск гостей: фамилия, имя, телефон, email. */
export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q, status } = normalizeSearchParams(await searchParams);
  const query = (q ?? '').trim();
  const guests = query.length >= 2 ? await guestsApi.search(query) : [];
  return (
    <Page
      title="Гости"
      subtitle="Гости объекта и история проживания"
      actions={
        <Link className="btn" href="/reservations/new">
          <Icon name="plus" />
          Добавить гостя
        </Link>
      }
    >
      <form method="get" className="row toolbar">
        <Input
          name="q"
          minLength={2}
          maxLength={120}
          aria-label="Поиск гостей"
          defaultValue={query}
          placeholder="фамилия, имя, телефон или email"
          className="inp--grow"
        />
        <Button type="submit">Найти</Button>
      </form>
      {query.length === 1 && (
        <p className="hint" role="status">
          Введите не менее 2 символов для поиска.
        </p>
      )}
      {query.length >= 2 && (
        <Table data-testid="guests-table">
          <thead>
            <tr>
              {['Гость', 'Телефон', 'Email', 'Гражданство', 'Проживаний', 'Последний заезд'].map(
                (h) => (
                  <th key={h}>{h}</th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {guests.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  не найдено
                </td>
              </tr>
            )}
            {guests.map((g) => (
              <tr key={g.id}>
                <td>
                  <Link href={`/guests/${g.id}`}>
                    {g.lastName} {g.firstName} {g.middleName ?? ''}
                  </Link>
                </td>
                <td>{g.phone ?? '—'}</td>
                <td>{g.email ?? '—'}</td>
                <td>{g.citizenship ?? <span className="warn-text">нет</span>}</td>
                <td className="num">{g.staysCount}</td>
                <td>{g.lastStay ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {status && !Object.hasOwn(reservationStatuses, status) ? (
        <Alert boxed>
          Выберите статус гостя. <Link href="/guests">Сбросить фильтры</Link>
        </Alert>
      ) : (
        query.length < 2 && <GuestDirectory {...(status ? { status } : {})} />
      )}
    </Page>
  );
}
