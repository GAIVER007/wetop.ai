import Link from 'next/link';
import { GuestDirectory } from './guest-directory';
import { Icon } from '../../components/icon';
import { guestsApi } from '../../lib/api';
import { Page } from '../../components/page';
import { Button, Input, Table } from '../../components/ui';

/** Поиск гостей: фамилия, имя, телефон, email. */
export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
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
          aria-label="Поиск гостей"
          defaultValue={query}
          placeholder="фамилия, имя, телефон или email"
          className="inp--grow"
        />
        <Button type="submit">Найти</Button>
      </form>
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
      {query.length < 2 && <GuestDirectory {...(status ? { status } : {})} />}
    </Page>
  );
}
