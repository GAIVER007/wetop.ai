'use client';
import { useRouter } from 'next/navigation';
import { Select } from '../../components/ui';
import { useT } from '../../i18n/locale-provider';

/** «Показать по 10»: размер страницы в адресе, смена переходит на первую страницу (ссылки считает сервер) */
export function PageSize({ value, hrefs }: { value: number; hrefs: Record<number, string> }) {
  const t = useT();
  const router = useRouter();
  return (
    <label className="gb-size">
      <span>{t('Показать по')}</span>
      <Select
        value={value}
        aria-label={t('Размер страницы')}
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
