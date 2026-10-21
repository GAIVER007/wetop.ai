import type { ReactNode } from 'react';
import { PeriodPicker } from '../components/period-picker';

/**
 * Выбор периода одного вида для «Финансов» и «Обзора продаж» салона и ресторана (аудит 21.10.2026, пп. 1, 22):
 * чипы «7 дней / 30 дней» и поля «С / По» в одной форме, период живёт в адресе (`from`, `to`).
 */
const DAY = 86_400_000;
export const shiftDay = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

export function lastDaysHref(path: string, today: string, days: number): string {
  return `${path}?from=${shiftDay(today, -(days - 1))}&to=${today}`;
}

export function PeriodBar({
  path,
  from,
  to,
  today,
  testId,
  presets,
  note,
}: {
  path: string;
  from: string;
  to: string;
  today: string;
  testId: string;
  /** свои ссылки готовых отрезков; по умолчанию `?from=&to=` последних 7 и 30 дней */
  presets?: Array<{ label: string; href: string; selected: boolean }>;
  note?: ReactNode;
}) {
  const own = presets ?? [7, 30].map((days) => ({
    label: `${days} дней`,
    href: lastDaysHref(path, today, days),
    selected: to === today && from === shiftDay(today, -(days - 1)),
  }));
  return (
    <form className="period-bar" action={path} method="get" data-testid={testId}>
      <PeriodPicker from={from} to={to} fromName="from" toName="to" presets={own}>
        <button className="btn btn--secondary" type="submit">
          Показать
        </button>
        {note && <span className="muted">{note}</span>}
      </PeriodPicker>
    </form>
  );
}
