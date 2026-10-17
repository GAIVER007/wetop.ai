'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { DateBar as SharedDateBar } from '../../components/date-bar';

/**
 * День журнала салона: общий `DateBar` (MV8.5 DS1c). Адрес дня и «Сегодня» держит экран: `?date=` у
 * пути, «Сегодня» без даты, как было; кнопки ведут туда же, куда раньше вели ссылки.
 */
export function DateBar({ date, path }: { date: string; path: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const href = (next?: string) => {
    const query = new URLSearchParams(params.toString());
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
    />
  );
}
