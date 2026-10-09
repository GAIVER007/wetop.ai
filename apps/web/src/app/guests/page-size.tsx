'use client';
import { useRouter } from 'next/navigation';
import { Select } from '../../components/ui';

/** «Показать по 10»: размер страницы в адресе, смена переходит на первую страницу (ссылки считает сервер) */
export function PageSize({ value, hrefs }: { value: number; hrefs: Record<number, string> }) {
  const router = useRouter();
  return (
    <label className="gb-size">
      <span>Показать по</span>
      <Select
        value={value}
        aria-label="Размер страницы"
        onChange={(event) => {
          const href = hrefs[Number(event.currentTarget.value)];
          if (href) router.push(href, { scroll: false });
        }}
      >
        {Object.keys(hrefs).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </Select>
    </label>
  );
}
