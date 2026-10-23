'use client';
import { Tabs } from '../../components/tabs';
import { useDeskVertical } from '../../components/desk-access';
import type { WebVertical } from '../../lib/vertical-landing';
import { verticalCopy } from '../../lib/vertical-copy';

/**
 * Вкладки раздела «Бар» (ADR-157): пять подстраниц вместо одного полотна. «Новый приход» живёт под
 * «Приходами» и своей вкладки не имеет. Право у всех одно: пункт меню `/bar` (`routeRule`).
 */
export type BarSection = 'warehouse' | 'bar' | 'receipts' | 'products' | 'suppliers' | 'operations' | 'consumables';

// подписи вкладок совпадают с пунктами меню «Склад» (решение владельца 19.10.2026)
const SECTIONS: Array<{ id: BarSection; href: string; label: string }> = [
  { id: 'warehouse', href: '/warehouse', label: 'Обзор склада' },
  { id: 'bar', href: '/bar', label: 'Бар' },
  { id: 'receipts', href: '/bar/receipts', label: 'Приходы' },
  { id: 'products', href: '/bar/products', label: 'Номенклатура' },
  { id: 'suppliers', href: '/bar/suppliers', label: 'Поставщики' },
  { id: 'operations', href: '/bar/operations', label: 'Движение товаров' },
];

export function barSectionsFor(vertical: WebVertical) {
  // склад материалов: салон и гостиница зовут его «Расходники» (аудит 22.10.2026); у ресторана он на `/stock` (ADR-STOCK-ALL)
  const kitchen =
    vertical === 'FOOD_SERVICE'
      ? { id: 'consumables' as const, href: '/stock', label: 'Склад кухни' }
      : { id: 'consumables' as const, href: '/bar/consumables', label: 'Расходники' };
  // товары на продажу: у салона «Товары», у гостиницы и ресторана «Бар» (слово из `vertical-copy.ts`)
  const goods = { ...SECTIONS[1]!, label: verticalCopy(vertical).menu.goods };
  return [SECTIONS[0]!, goods, kitchen, ...SECTIONS.slice(2)];
}

export function BarTabs({ current }: { current: BarSection }) {
  const vertical = useDeskVertical();
  return (
    <Tabs
      label="Разделы склада"
      className="bar-tabs"
      items={barSectionsFor(vertical).map((section) => ({
        href: section.href,
        label: section.label,
        current: section.id === current,
      }))}
    />
  );
}
