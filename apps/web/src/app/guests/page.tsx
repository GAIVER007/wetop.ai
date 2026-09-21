import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import Link from 'next/link';
import { reservationStatuses } from '../../lib/hotel-api';
import { GuestDirectory } from './guest-directory';
import { Icon } from '../../components/icon';
import { guestsApi, messengerLinks } from '../../lib/api';
import { Page } from '../../components/page';
import { Alert, Button, EmptyState, Field, Input, Table } from '../../components/ui';
import { displayDate } from '../../lib/display-date';
import { pluralRu } from '../../lib/plural';
import '../directory.css';

/**
 * Поиск гостей: фамилия, имя, телефон, email. D1 (план владельца 19.09): выборка названа словами, пустой
 * результат говорит, что сделать; строка — одна линия, на телефоне складывается в карточку; длинные
 * имена переносятся, а не режутся.
 */
export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q, status } = normalizeSearchParams(await searchParams);
  const query = (q ?? '').trim();
  const searching = query.length >= 2;
  const guests = searching ? await guestsApi.search(query) : [];
  return (
    <Page
      title="Гости"
      subtitle="Гости объекта и история проживания"
      // Гость заводится вместе с бронью — отдельной формы гостя нет, и кнопка это называет
      actions={
        <Link className="btn" href="/reservations/new">
          <Icon name="plus" />
          Новая бронь с гостем
        </Link>
      }
    >
      <form method="get" className="row toolbar directory-toolbar">
        <Field inline label="Поиск">
          <Input
            key={`q-${query}`}
            name="q"
            minLength={2}
            maxLength={120}
            aria-label="Поиск гостей"
            defaultValue={query}
            placeholder="фамилия, имя, телефон или email"
            className="inp--grow"
          />
        </Field>
        <Button type="submit">Найти</Button>
        {searching && (
          <Link href="/guests" className="btn btn--secondary">
            Убрать поиск
          </Link>
        )}
      </form>
      {query.length === 1 && (
        <p className="hint" role="status">
          Введите не менее 2 символов для поиска.
        </p>
      )}
      {searching && guests.length > 0 && (
        <>
          <p className="directory-meta" data-testid="guests-meta">
            {pluralRu(guests.length, ['гость', 'гостя', 'гостей'])} по запросу «{query}»
          </p>
          <Table data-testid="guests-table" className="dir-table dir-table--guests" nowrap>
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
              {guests.map((g) => {
                const wa = messengerLinks(g.phone);
                return (
                  <tr key={g.id}>
                    <td>
                      <Link className="dir-guest" href={`/guests/${g.id}`}>
                        <strong>
                          {g.lastName} {g.firstName} {g.middleName ?? ''}
                        </strong>
                      </Link>
                    </td>
                    <td className="dir-phone">
                      <span>{g.phone ?? '—'}</span>
                      {wa && (
                        <a
                          className="dir-wa"
                          href={wa.whatsapp}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`WhatsApp: ${g.lastName} ${g.firstName}`}
                        >
                          WA
                        </a>
                      )}
                    </td>
                    <td>{g.email ?? '—'}</td>
                    <td>{g.citizenship ?? <span className="warn-text">—</span>}</td>
                    <td className="num">
                      <span className="dir-cell-word">проживаний </span>
                      {g.staysCount}
                    </td>
                    <td>
                      {g.lastStay ? (
                        <>
                          <span className="dir-cell-word">заезд </span>
                          <time dateTime={g.lastStay}>{displayDate(g.lastStay, 'numeric')}</time>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </>
      )}
      {searching && guests.length === 0 && (
        <EmptyState
          data-testid="guests-empty"
          icon={<Icon name="guests" />}
          title={`Гостей по запросу «${query}» не найдено`}
          actions={
            <>
              <Link href="/guests" className="btn btn--secondary">
                Убрать поиск
              </Link>
              <Link href="/reservations/new" className="btn btn--secondary">
                Новая бронь с гостем
              </Link>
            </>
          }
        >
          Проверьте написание или найдите гостя по телефону. Новый гость заводится вместе с бронью.
        </EmptyState>
      )}
      {status && !Object.hasOwn(reservationStatuses, status) ? (
        <Alert boxed>
          Выберите статус гостя. <Link href="/guests">Сбросить фильтры</Link>
        </Alert>
      ) : (
        !searching && <GuestDirectory {...(status ? { status } : {})} />
      )}
    </Page>
  );
}
