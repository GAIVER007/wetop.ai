import { requireFeature } from '../../../lib/vertical-guard';
import Link from 'next/link';
import { guestsApi } from '../../../lib/api';
import { hotelToday } from '../../../lib/hotel-api';
import { displayDate } from '../../../lib/display-date';
import { pluralRu } from '../../../lib/plural';
import { Page } from '../../../components/page';
import { EmptyState, Table } from '../../../components/ui';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';

/**
 * «Дни рождения» (образец Lite PMS, Q-249 T0): именинники сегодня и в ближайшую неделю, из уже
 * хранимой даты рождения гостя. Только чтение; поздравлять — по телефону из карточки гостя.
 */
export default async function BirthdaysPage() {
  await requireFeature('/guests/birthdays');
  const today = await hotelToday();
  let failure: unknown = null;
  const list = await guestsApi.birthdays(today, 7).catch((e: unknown) => {
    failure = e;
    return null;
  });
  const section = (title: string, rows: NonNullable<typeof list>, empty: string) => (
    <section aria-label={title}>
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <Table density="normal" aria-label={`Именинники: ${title.toLowerCase()}`}>
          <thead>
            <tr>
              <th>Гость</th>
              <th>Дата</th>
              <th>Исполняется</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.id} data-testid="birthday-row">
                <td>
                  <Link href={`/guests/${encodeURIComponent(g.id)}`}>
                    {g.lastName} {g.firstName}
                  </Link>
                </td>
                <td>{displayDate(g.date, 'full')}</td>
                <td>{pluralRu(g.age, ['год', 'года', 'лет'])}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </section>
  );
  return (
    <Page title="Дни рождения" subtitle="Гости с днём рождения сегодня и в ближайшие 7 дней">
      {list === null ? (
        <LoadError
          testId="birthdays-error"
          title="Не удалось загрузить дни рождения"
          {...loadErrorProps(failure)}
        />
      ) : list.length === 0 ? (
        <EmptyState title="В ближайшую неделю дней рождения нет">
          Дата рождения берётся из карточки гостя.
        </EmptyState>
      ) : (
        <>
          {section('Сегодня', list.filter((g) => g.date === today), 'Сегодня именинников нет.')}
          {section('Ближайшие 7 дней', list.filter((g) => g.date !== today), 'Больше в эту неделю нет.')}
        </>
      )}
    </Page>
  );
}
