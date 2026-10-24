'use client';
import { useRouter } from 'next/navigation';
import { DateBar } from '../../components/date-bar';
import { Field, Input, Select } from '../../components/ui';
import { shiftDate } from '../../lib/food-data';
import type { FoodWorkspace } from '../../lib/food-types';
import { localInput } from '../beauty/time';
import { useT } from '../../i18n/locale-provider';

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
  const t = useT();
  const router = useRouter();
  const path = floor ? '/floor-plan' : '/table-reservations';
  function go(date: string, time?: string) {
    const q = new URLSearchParams({ date });
    if (time) q.set('time', time);
    router.push(`${path}?${q}`);
  }
  // смены выбранного дня (weekday как в load.ts: getUTCDay, 0 это воскресенье)
  const weekday = new Date(`${data.date}T12:00:00Z`).getUTCDay();
  const shifts = data.periods
    .filter((p) => p.active && p.weekday === weekday)
    .sort((a, b) => a.timeFrom.localeCompare(b.timeFrom));
  return (
    <>
      {/* день: общий DateBar (MV8.5 DS1c); переход сразу при смене даты */}
      <DateBar
        calendar
        compact
        className="rest-day-bar"
        date={data.date}
        onPrevious={() => go(shiftDate(data.date, -1))}
        onNext={() => go(shiftDate(data.date, 1))}
        onDateChange={(next) => go(next)}
        // «Сегодня» на расписании, как на макете (экран 3); на плане зала её нет, как и раньше
        onToday={
          floor
            ? undefined
            : () => go(localInput(new Date().toISOString(), data.timezone).slice(0, 10))
        }
      />
      {/* план зала: смены карточками с часами, как на эталоне 13.10.2026; на расписании прежний список */}
      {floor && shifts.length > 0 ? (
        <div className="rest-shifts" role="group" aria-label={t('Период')}>
          {shifts.map((p) => (
            <button
              key={p.id}
              type="button"
              className="rest-shift"
              aria-pressed={period === p.id}
              onClick={() => setPeriod(period === p.id ? '' : p.id)}
            >
              <strong>{p.name}</strong>
              <span>
                {p.timeFrom}–{p.timeTo}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <Field label={quiet(t('Период'))}>
          <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="">{t('Все периоды')}</option>
            {data.periods
              .filter((p) => p.active)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </Select>
        </Field>
      )}
      {floor && (
        <Field label={quiet(t('Время плана'))}>
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
