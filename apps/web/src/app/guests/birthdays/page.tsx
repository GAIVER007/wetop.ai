import { requireFeature } from '../../../lib/vertical-guard';
import Link from 'next/link';
import { guestsApi } from '../../../lib/api';
import { hotelToday } from '../../../lib/hotel-api';
import { displayDate } from '../../../lib/display-date';
import { countLabel, intlLocale, msg } from '../../../i18n';
import { currentLocale, serverT } from '../../../i18n/server';
import { Page } from '../../../components/page';
import { EmptyState, Table } from '../../../components/ui';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';
import { guestDisplayName } from '../guest-stay';

/**
 * «Дни рождения» (образец Lite PMS, Q-249 T0): именинники сегодня и в ближайшую неделю, из уже
 * хранимой даты рождения гостя. Только чтение; поздравлять — по телефону из карточки гостя.
 */
export default async function BirthdaysPage() {
  await requireFeature('/guests/birthdays');
  const t = await serverT();
  const locale = await currentLocale();
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
        <Table density="normal" aria-label={t('Именинники: {title}', { title: title.toLowerCase() })}>
          <thead>
            <tr>
              <th>{t('Гость')}</th>
              <th>{t('Дата')}</th>
              <th>{t('Исполняется')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.id} data-testid="birthday-row">
                <td>
                  <Link href={`/guests/${encodeURIComponent(g.id)}`}>
                    {guestDisplayName(g)}
                  </Link>
                </td>
                <td>{displayDate(g.date, 'full', intlLocale(locale))}</td>
                <td>{countLabel(locale, t, g.age, [msg('год'), 'года', msg('лет')]) /* kk-allow: форма склонения */}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </section>
  );
  return (
    <Page title={t('Дни рождения')} subtitle={t('Гости с днём рождения сегодня и в ближайшие 7 дней')}>
      {list === null ? (
        <LoadError
          testId="birthdays-error"
          title={t('Не удалось загрузить дни рождения')}
          {...loadErrorProps(failure)}
        />
      ) : list.length === 0 ? (
        <EmptyState title={t('В ближайшую неделю дней рождения нет')}>
          {t('Дата рождения берётся из карточки гостя.')}
        </EmptyState>
      ) : (
        <>
          {section(t('Сегодня'), list.filter((g) => g.date === today), t('Сегодня именинников нет.'))}
          {section(t('Ближайшие 7 дней'), list.filter((g) => g.date !== today), t('Больше в эту неделю нет.'))}
        </>
      )}
    </Page>
  );
}
