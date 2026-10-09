'use client';
import { useRouter } from 'next/navigation';
import { DateBar as SharedDateBar } from '../../components/date-bar';

/**
 * День журнала салона: общий `DateBar` (MV8.5 DS1c). Адрес дня и «Сегодня» держит экран: `?date=` у
 * пути, «Сегодня» без даты, как было; кнопки ведут туда же, куда раньше вели ссылки.
 */
export function DateBar({ date, path }: { date: string; path: string }) {
  const router = useRouter();
  const shift = (n: number) => {
    const at = new Date(`${date}T12:00:00Z`);
    at.setUTCDate(at.getUTCDate() + n);
    return `${path}?date=${at.toISOString().slice(0, 10)}`;
  };
  return (
    <SharedDateBar
      date={date}
      onToday={() => router.push(path)}
      onPrevious={() => router.push(shift(-1))}
      onNext={() => router.push(shift(1))}
      onDateChange={(next) => router.push(`${path}?date=${next}`)}
      inputProps={{ 'data-testid': 'beauty-day-date' }}
    />
  );
}
