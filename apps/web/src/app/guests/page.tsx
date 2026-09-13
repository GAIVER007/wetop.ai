import Link from 'next/link';
import { guestsApi } from '../../lib/api';
import { Page } from '../../components/page';
import { Button, Input, Panel, Table } from '../../components/ui';

/** Поиск гостей: фамилия, имя, телефон, email. */
export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? '').trim();
  const guests = query.length >= 2 ? await guestsApi.search(query) : [];
  return (
    <Page title="Гости" width="medium" subtitle="Контакты, документы и история проживаний">
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
      {query.length < 2 && (
        /* Пустой экран без подсказки выглядит как незагрузившаяся страница: говорим, что искать и зачем */
        <Panel size="lg">
          <p className="hint--lg">
            Найдите гостя по фамилии, имени, телефону или почте — хватит двух букв. В карточке гостя
            видно гражданство, документ и все его проживания: удобно, когда гость звонит и просит
            «как в прошлый раз».
          </p>
          <p className="hint">
            Гость создаётся при оформлении брони — отдельно создавать его не
            нужно.
          </p>
        </Panel>
      )}
    </Page>
  );
}
