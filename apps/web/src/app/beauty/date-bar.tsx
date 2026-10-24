'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { DateBar as SharedDateBar } from '../../components/date-bar';
import { useT } from '../../i18n/locale-provider';

/**
 * День журнала салона: общий `DateBar` (MV8.5 DS1c). Адрес дня и «Сегодня» держит экран: `?date=` у
 * пути, «Сегодня» без даты, как было; кнопки ведут туда же, куда раньше вели ссылки.
 */
export function DateBar({ date, path, filters }: { date: string; path: string; filters?: Record<string, string> }) {
  const router = useRouter();
  const t = useT();
  const params = useSearchParams();
  const href = (next?: string) => {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(filters ?? {})) {
      if (value) query.set(key, value);
      else query.delete(key);
    }
    if (next) query.set('date', next);
    else query.delete('date');
    return `${path}?${query}`;
  };
  const shift = (n: number) => {
    const at = new Date(`${date}T12:00:00Z`);
    at.setUTCDate(at.getUTCDate() + n);
    return href(at.toISOString().slice(0, 10));
  };
  return (
    <SharedDateBar
      calendar
      date={date}
      onToday={() => router.push(href())}
      onPrevious={() => router.push(shift(-1))}
      onNext={() => router.push(shift(1))}
      onDateChange={(next) => router.push(href(next))}
      inputProps={{ 'data-testid': 'beauty-day-date' }}
      compact
      presets={[
        { label: t('Вчера'), offsetDays: -1 },
        { label: t('Завтра'), offsetDays: 1 },
        {
          label: t('Эта неделя'),
          onSelect: () => {
            const query = new URLSearchParams(href(date).split('?')[1]);
            query.set('view', 'week');
            router.push(`${path}?${query}`);
          },
        },
      ]}
    />
  );
}
