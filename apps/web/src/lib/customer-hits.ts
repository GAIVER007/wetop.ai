import type { WebVertical } from './vertical-landing';

/** Найденный клиент для поиска в шапке (аудит 22.10.2026 P1-4) */
export interface CustomerHit {
  id: string;
  href: string;
  label: string;
  /** телефон, если есть: помогает различить тёзок */
  hint: string | null;
}

/** Сколько клиентов показывает окно поиска: дальше уточняют запрос */
export const CUSTOMER_HITS_SHOWN = 5;

/** Запрос короче двух знаков не уходит в API: одна буква находит всех */
export const customerQueryReady = (query: string) => query.trim().length >= 2;

/**
 * Строки клиентов в ссылки окна поиска. Салон: карточка клиента с визитами и записями. Ресторан: своей карточки
 * у гостя нет, ссылка открывает «Клиентов» с этим гостем в списке (`?q=`).
 */
export function customerHits(
  vertical: WebVertical,
  rows: Array<{ id: string; firstName: string; lastName: string | null; phone: string | null }>,
): CustomerHit[] {
  return rows.slice(0, CUSTOMER_HITS_SHOWN).map((row) => {
    const label = [row.firstName, row.lastName].filter(Boolean).join(' ');
    return {
      id: row.id,
      label,
      hint: row.phone,
      href:
        vertical === 'BEAUTY'
          ? `/customers/${encodeURIComponent(row.id)}`
          : `/customers?${new URLSearchParams({ q: row.phone ?? label })}`,
    };
  });
}

/**
 * Отбор гостей ресторана по `?q=` из поиска в шапке: каждое слово в имени или телефоне, телефон сравнивается и
 * по цифрам («8 700 000» найдёт «+7 700 000 …»). Тот же смысл, что у отбора API (apps/api/src/customers/search.ts).
 */
export function matchesCustomerQuery(
  row: { firstName: string; lastName: string | null; phone: string | null },
  query: string,
): boolean {
  const q = query.trim().toLocaleLowerCase('ru');
  if (!q) return true;
  const digits = (v: string) => {
    const d = v.replace(/\D/g, '');
    return d.startsWith('8') ? `7${d.slice(1)}` : d;
  };
  if (/^[\d\s()+.-]+$/.test(q)) {
    const d = digits(q);
    return !!row.phone && (row.phone.includes(q) || (d.length >= 3 && digits(row.phone).includes(d)));
  }
  const text = `${row.firstName} ${row.lastName ?? ''} ${row.phone ?? ''}`.toLocaleLowerCase('ru');
  return q.split(/\s+/).every((word) => text.includes(word));
}
