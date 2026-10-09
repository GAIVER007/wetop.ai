'use client';
import { useRouter } from 'next/navigation';
import { Select } from '../../components/ui';

/**
 * Выпадающий отбор «Гостей и бронирований» («Статус», «Источник», «Период»): смена значения сразу переходит по
 * адресу с этим отбором (адрес остаётся источником состояния), без кнопки «Показать». Ссылки для каждого значения
 * считает сервер. Без JavaScript поле показывает текущий отбор, а чипы и плитки по-прежнему ссылки.
 */
export interface FilterOption {
  value: string;
  label: string;
  href: string;
  /** подпись группы: `optgroup`, одинаковые подряд идут одной группой */
  group?: string;
}

export function FilterSelect({
  label,
  value,
  options,
  name,
}: {
  label: string;
  value: string;
  options: FilterOption[];
  name: string;
}) {
  const router = useRouter();
  const groups: Array<{ label: string | null; items: FilterOption[] }> = [];
  for (const o of options) {
    const last = groups.at(-1);
    if (last && last.label === (o.group ?? null)) last.items.push(o);
    else groups.push({ label: o.group ?? null, items: [o] });
  }
  return (
    <label className="gb-filter">
      <span className="gb-filter__label">{label}</span>
      <Select
        name={name}
        value={value}
        aria-label={label}
        onChange={(event) => {
          const next = options.find((o) => o.value === event.currentTarget.value);
          if (next) router.push(next.href, { scroll: false });
        }}
      >
        {groups.map((g, i) =>
          g.label ? (
            <optgroup key={i} label={g.label}>
              {g.items.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ) : (
            g.items.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))
          ),
        )}
      </Select>
    </label>
  );
}
