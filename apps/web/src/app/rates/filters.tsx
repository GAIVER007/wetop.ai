'use client';
import Link from 'next/link';
import { Field, Select } from '../../components/ui';
import { Icon } from '../../components/icon';

const monthTitle = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'UTC',
  month: 'long',
  year: 'numeric',
});
const monthLabel = (ym: string) =>
  monthTitle.format(new Date(`${ym}-01T00:00:00Z`)).replace(' г.', '');
const addMonths = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
};

/** Единая GET-панель: категория, тариф и месяц. Смена поля сразу обновляет календарь. */
export function RatesFilters(props: {
  categories: Array<{ code: string; name: string }>;
  ratePlans: Array<{ code: string; name: string; currency: string; active: boolean }>;
  category: string;
  ratePlan: string;
  month: string;
  /** Месяц объекта сегодня — от него строится список месяцев */
  currentMonth: string;
  validMonth: boolean;
}) {
  const submit = (e: React.ChangeEvent<HTMLSelectElement>) => e.currentTarget.form?.requestSubmit();
  const href = (category: string, ratePlan: string, month = props.month) =>
    `/rates?category=${category}&ratePlan=${ratePlan}&month=${month}`;
  // год назад и два вперёд от месяца объекта; месяц из адреса всегда в списке
  const months = Array.from({ length: 37 }, (_, i) => addMonths(props.currentMonth, i - 12));
  if (props.validMonth && !months.includes(props.month)) months.unshift(props.month);
  return (
    // Ключ в page.tsx перемонтирует блок при смене адреса: поля неуправляемые, чтобы requestSubmit
    // уходил с только что выбранным значением, а листание месяца ссылками не оставляло старое в поле
    <div className="rates-filters" data-testid="rates-filters">
      <form method="get" className="rates-filters__controls">
        <div className="rates-filters__selects">
          <Field label="Категория">
            <Select
              aria-label="Категория"
              name="category"
              defaultValue={props.category}
              onChange={submit}
            >
              {props.categories.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Тариф">
            <Select
              aria-label="Тариф"
              name="ratePlan"
              defaultValue={props.ratePlan}
              onChange={submit}
            >
              {props.ratePlans.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name} ({p.currency}){p.active ? '' : ' — неактивен'}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="rates-month" role="group" aria-label="Месяц календаря">
          {props.validMonth && (
            <Link
              href={href(props.category, props.ratePlan, addMonths(props.month, -1))}
              className="icon-button"
              aria-label="Предыдущий месяц"
            >
              <Icon name="chevron" className="rotate-left" />
            </Link>
          )}
          <Select
            name="month"
            aria-label="Месяц"
            className="rates-month__select"
            defaultValue={props.validMonth ? props.month : props.currentMonth}
            onChange={submit}
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </Select>
          {props.validMonth && (
            <Link
              href={href(props.category, props.ratePlan, addMonths(props.month, 1))}
              className="icon-button"
              aria-label="Следующий месяц"
            >
              <Icon name="chevron" />
            </Link>
          )}
          <Link
            href={`/rates?category=${props.category}&ratePlan=${props.ratePlan}`}
            className="rates-month__today"
          >
            Сегодня
          </Link>
        </div>
      </form>
    </div>
  );
}
