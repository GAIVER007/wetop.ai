import Link from 'next/link';
import { cx } from '../../components/ui';
import { DateInput } from '../../components/date-field';

/** Следующий день ISO-даты: строки дат без времени безопасно считать в UTC */
const nextDay = (iso: string) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/**
 * Полоса дня (A1, ADR-103): Главная живёт одним операционным днём — сегодня, завтра или выбранная
 * дата (`?date=`, как раньше). Отрезков здесь больше нет: периоды и сравнение — на
 * «Показателях за период» (`/management/dashboard`). Пресеты — GET-ссылки без JS, как в PeriodBar.
 */
export function DayBar({ date, today }: { date: string; today: string }) {
  const tomorrow = nextDay(today);
  const presets = [
    { href: '/today', label: 'Сегодня', on: date === today },
    { href: `/today?date=${tomorrow}`, label: 'Завтра', on: date === tomorrow },
  ];
  return (
    <nav className="day-bar" aria-label="День стойки">
      <div className="seg day-presets">
        {presets.map((p) => (
          <Link key={p.label} href={p.href} className={cx(p.on && 'is-on')} aria-current={p.on ? 'page' : undefined}>
            {p.label}
          </Link>
        ))}
      </div>
      <form method="get" className="day-custom" data-testid="day-form">
        <label>
          Дата
          <DateInput name="date" defaultValue={date} aria-label="День стойки: дата" />
        </label>
        <button type="submit" className="btn btn--secondary">
          Показать
        </button>
      </form>
    </nav>
  );
}
