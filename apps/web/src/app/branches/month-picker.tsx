import { Icon } from '../../components/icon';
export function MonthPicker({ month }: { month: string }) {
  const year = Number(month.slice(0, 4)),
    index = Number(month.slice(5, 7)) - 1;
  const shift = (offset: number) => {
    const date = new Date(Date.UTC(year, index + offset, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  };
  return (
    <nav className="org-month" aria-label="Месяц отчёта">
      <a href={`/branches?month=${shift(-1)}`} aria-label="Предыдущий месяц">
        <Icon name="back" />
      </a>
      <form action="/branches" method="GET">
        <label>
          <span>Период отчёта</span>
          <input type="month" name="month" defaultValue={month} required />
        </label>
        <button type="submit">Показать</button>
      </form>
      <a href={`/branches?month=${shift(1)}`} aria-label="Следующий месяц">
        <Icon name="arrow" />
      </a>
    </nav>
  );
}
