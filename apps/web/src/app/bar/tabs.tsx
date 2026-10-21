'use client';
import { Tabs } from '../../components/tabs';
import { useDeskVertical } from '../../components/desk-access';
import type { WebVertical } from '../../lib/vertical-landing';

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
  // склад кухни: салон зовёт его «Расходники», остальные «Кухня»; у ресторана он на `/stock` (ADR-STOCK-ALL)
  const kitchen =
    vertical === 'FOOD_SERVICE'
      ? { id: 'consumables' as const, href: '/stock', label: 'Склад кухни' }
      : { id: 'consumables' as const, href: '/bar/consumables', label: vertical === 'BEAUTY' ? 'Расходники' : 'Кухня' };
  return [SECTIONS[0]!, SECTIONS[1]!, kitchen, ...SECTIONS.slice(2)];
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
