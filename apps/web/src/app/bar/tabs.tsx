'use client';
import { Tabs } from '../../components/tabs';
import { useDeskVertical } from '../../components/desk-access';
import type { WebVertical } from '../../lib/vertical-landing';
import { verticalCopy } from '../../lib/vertical-copy';
import { msg } from '../../i18n';
import { useT } from '../../i18n/locale-provider';

/**
 * Вкладки раздела «Бар» (ADR-157): пять подстраниц вместо одного полотна. «Новый приход» живёт под
 * «Приходами» и своей вкладки не имеет. Право у всех одно: пункт меню `/bar` (`routeRule`).
 */
export type BarSection = 'warehouse' | 'bar' | 'receipts' | 'products' | 'suppliers' | 'operations' | 'consumables';

// подписи вкладок совпадают с пунктами меню «Склад» (решение владельца 19.10.2026)
const SECTIONS: Array<{ id: BarSection; href: string; label: string }> = [
  { id: 'warehouse', href: '/warehouse', label: msg('Обзор склада') },
  { id: 'bar', href: '/bar', label: msg('Бар') },
  { id: 'receipts', href: '/bar/receipts', label: msg('Приходы') },
  { id: 'products', href: '/bar/products', label: msg('Номенклатура') },
  { id: 'suppliers', href: '/bar/suppliers', label: msg('Поставщики') },
  { id: 'operations', href: '/bar/operations', label: msg('Движение товаров') },
];

export function barSectionsFor(vertical: WebVertical) {
  // склад кухни (решение владельца 24.10.2026): у салона и гостиницы «Кухня»; у ресторана «Склад кухни» на `/stock`,
  // его «Кухня» уже экран заказов (ADR-STOCK-ALL)
  const kitchen =
    vertical === 'FOOD_SERVICE'
      ? { id: 'consumables' as const, href: '/stock', label: msg('Склад кухни') }
      : { id: 'consumables' as const, href: '/bar/consumables', label: msg('Кухня') };
  // товары на продажу: «Бар» у всех направлений (слово из `vertical-copy.ts`)
  const goods = { ...SECTIONS[1]!, label: verticalCopy(vertical).menu.goods };
  return [SECTIONS[0]!, goods, kitchen, ...SECTIONS.slice(2)];
}

export function BarTabs({ current }: { current: BarSection }) {
  const vertical = useDeskVertical();
  const t = useT();
  return (
    <Tabs
      label={t('Разделы склада')}
      className="bar-tabs"
      items={barSectionsFor(vertical).map((section) => ({
        href: section.href,
        label: t(section.label),
        current: section.id === current,
      }))}
    />
  );
}
