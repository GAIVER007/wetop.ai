'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { JournalFilter, JournalSearch } from '../../../components/journal-head';
import { Chip } from '../../../components/chip';
import { msg } from '../../../i18n';
import { useT } from '../../../i18n/locale-provider';
import { MOVEMENT_TYPES, typeFromHash, type MovementPeriod, type MovementType } from './movements-feed';

export const TYPE_LABEL: Record<MovementType, string> = {
  sales: msg('Продажи'),
  returns: msg('Возвраты'),
  writeoff: msg('Списание'),
  inventory: msg('Инвентаризация'),
  receipts: msg('Приходы'),
};

const PERIODS: Array<{ value: Exclude<MovementPeriod, ''>; label: string }> = [
  { value: 'today', label: msg('Сегодня') },
  { value: 'yesterday', label: msg('Вчера') },
  { value: 'week', label: msg('Эта неделя') },
  { value: 'month', label: msg('Этот месяц') },
];

/**
 * Строка отборов ленты движений склада, как у журналов (`journal-head__filters`): период, поиск товара, тип.
 * Всё живёт в адресе (`period`, `q`, `type`); старые якоря вкладок (#bar-sales и т.п.) ставят тип.
 */
export function MovementFilters({ type, period, query }: { type: MovementType | ''; period: MovementPeriod; query: string }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [text, setText] = useState(query);
  const href = (patch: Record<string, string>, hash = '') => {
    const next = new URLSearchParams(params?.toString() ?? '');
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const qs = next.toString();
    return `${pathname}${qs ? `?${qs}` : ''}${hash}`;
  };
  useEffect(() => {
    const mapped = typeFromHash(location.hash);
    if (mapped === undefined || mapped === type) return;
    // якоря окон (#bar-writeoff, #bar-inventory) остаются в адресе: по ним открывается окно
    const keep = location.hash === '#bar-writeoff' || location.hash === '#bar-inventory' ? location.hash : '';
    router.replace(href({ type: mapped }, keep), { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="journal-head__filters bar-movement-filters" role="group" aria-label={t('Отборы движений')}>
      <JournalFilter
        label={t('Период')}
        allLabel={t('Все периоды')}
        value={period}
        onChange={(value) => router.replace(href({ period: value }), { scroll: false })}
        options={PERIODS.map((p) => ({ value: p.value, label: t(p.label) }))}
      />
      <JournalSearch
        label={t('Поиск товара')}
        placeholder={t('Поиск товара')}
        value={text}
        onChange={(value) => {
          setText(value);
          router.replace(href({ q: value.trim() }), { scroll: false });
        }}
      />
      <div className="bar-movement-types" role="group" aria-label={t('Тип движения')}>
        <Chip size="sm" selected={type === ''} href={href({ type: '' })}>
          {t('Все')}
        </Chip>
        {MOVEMENT_TYPES.map((value) => (
          <Chip key={value} size="sm" selected={type === value} href={href({ type: value })}>
            {t(TYPE_LABEL[value])}
          </Chip>
        ))}
      </div>
    </div>
  );
}
