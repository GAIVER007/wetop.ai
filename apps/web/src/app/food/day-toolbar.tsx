'use client';
import { useRouter } from 'next/navigation';
import { DateBar } from '../../components/date-bar';
import { Field, Input, Select } from '../../components/ui';
import { shiftDate } from '../../lib/food-data';
import type { FoodWorkspace } from '../../lib/food-types';

/** Подпись поля только для программы чтения: панель экрана одной строкой, как на макете */
export const quiet = (text: string) => <span className="sr-only">{text}</span>;

/** День, период и время плана одной строкой (макет, экраны 2 и 3); адреса `?date=` и `?time=` прежние */
export function DayToolbar({
  data,
  floor,
  period,
  setPeriod,
}: {
  data: FoodWorkspace;
  floor: boolean;
  period: string;
  setPeriod: (v: string) => void;
}) {
  const router = useRouter();
  const path = floor ? '/floor-plan' : '/table-reservations';
  function go(date: string, time?: string) {
    const q = new URLSearchParams({ date });
    if (time) q.set('time', time);
    router.push(`${path}?${q}`);
  }
  return (
    <>
      {/* день: общий DateBar (MV8.5 DS1c); переход сразу при смене даты */}
      <DateBar
        compact
        date={data.date}
        onPrevious={() => go(shiftDate(data.date, -1))}
        onNext={() => go(shiftDate(data.date, 1))}
        onDateChange={(next) => go(next)}
      />
      <Field label={quiet('Период')}>
        <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="">Все периоды</option>
          {data.periods
            .filter((p) => p.active)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </Select>
      </Field>
      {floor && (
        <Field label={quiet('Время плана')}>
          <Input
            type="time"
            value={data.time}
            onChange={(e) => e.target.value && go(data.date, e.target.value)}
          />
        </Field>
      )}
    </>
  );
}
