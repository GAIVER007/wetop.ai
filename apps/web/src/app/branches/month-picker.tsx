import { Icon } from '../../components/icon';

const MONTHS = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
];

/** `2026-10` → «октябрь 2026»: подпись своя, родное поле месяца писало «October 2026» (аудит 22.10.2026, P1-1b). */
export function monthLabel(month: string): string {
  const index = Number(month.slice(5, 7)) - 1;
  return `${MONTHS[index] ?? month.slice(5, 7)} ${month.slice(0, 4)}`;
}

export function shiftMonth(month: string, offset: number): string {
  const date = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Месяц отчёта: «‹ октябрь 2026 ›», стрелки — ссылки с тем же параметром `?month=`. */
export function MonthPicker({ month }: { month: string }) {
  const previous = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  return (
    <nav className="org-month" aria-label="Месяц отчёта">
      <a href={`/branches?month=${previous}`} aria-label={`Предыдущий месяц: ${monthLabel(previous)}`}>
        <Icon name="back" />
      </a>
      <span className="org-month__label" aria-current="date">
        {monthLabel(month)}
      </span>
      <a href={`/branches?month=${next}`} aria-label={`Следующий месяц: ${monthLabel(next)}`}>
        <Icon name="arrow" />
      </a>
    </nav>
  );
}
