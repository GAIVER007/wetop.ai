'use client';
import Link from 'next/link';
import { Field, Input, Select } from '../../components/ui';
import { Icon } from '../../components/icon';

/**
 * Компактная шапка календаря (ТЗ v2 §4, §27–28): категория, тариф и месяц перезагружают данные сами —
 * кнопка «Показать» убрана, изменение любого поля отправляет ту же GET-форму. Кнопки месяца остаются
 * ссылками с прежними доступными именами (их ждут тесты и запись показа), «Сегодня» — месяц объекта.
 */
export function RatesFilters(props: {
  categories: Array<{ code: string; name: string }>;
  ratePlans: Array<{ code: string; name: string; currency: string; active: boolean }>;
  category: string;
  ratePlan: string;
  month: string;
  validMonth: boolean;
}) {
  const submit = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
    e.currentTarget.form?.requestSubmit();
  const shift = (n: number) => {
    const [y, m] = props.month.split('-').map(Number) as [number, number];
    const d = new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
    return `/rates?category=${props.category}&ratePlan=${props.ratePlan}&month=${d}`;
  };
  return (
    // Ключ в page.tsx перемонтирует форму при смене адреса: поля неуправляемые, чтобы requestSubmit
    // уходил с только что введённым значением, а листание месяца ссылками не оставляло старое в поле
    <form method="get" className="rates-filters" data-testid="rates-filters">
      <Field label="Категория">
        <Select name="category" defaultValue={props.category} onChange={submit}>
          {props.categories.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Тариф">
        <Select name="ratePlan" defaultValue={props.ratePlan} onChange={submit}>
          {props.ratePlans.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name} ({p.currency}){p.active ? '' : ' — неактивен'}
            </option>
          ))}
        </Select>
      </Field>
      <div className="rates-month" role="group" aria-label="Месяц календаря">
        {props.validMonth && (
          <Link href={shift(-1)} className="icon-button" aria-label="Предыдущий месяц">
            <Icon name="chevron" className="rotate-left" />
          </Link>
        )}
        <Field label="Месяц">
          <Input type="month" name="month" defaultValue={props.month} onChange={submit} />
        </Field>
        {props.validMonth && (
          <Link href={shift(1)} className="icon-button" aria-label="Следующий месяц">
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
  );
}
