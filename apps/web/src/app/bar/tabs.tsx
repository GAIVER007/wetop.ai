'use client';
import Link from 'next/link';
import { useDeskVertical } from '../../components/desk-access';
import type { WebVertical } from '../../lib/vertical-landing';
import { verticalCopy } from '../../lib/vertical-copy';
import { msg } from '../../i18n';
import { useT } from '../../i18n/locale-provider';

/**
 * Вкладки «Склада» (вариант C владельца 31.10.2026, «всё в одном окне»): сверху пять разделов (Обзор, Бар, Кухня,
 * Закупки, Движение), внутри раздела вторая строка: у «Бара» товары, меню бара и номенклатура, у «Закупок» приходы
 * и поставщики. Меню шапки «Склад» держит те же пять пунктов. Право у всех одно: пункт меню `/bar` (`routeRule`).
 */
export type BarSection = 'warehouse' | 'bar' | 'receipts' | 'products' | 'suppliers' | 'operations' | 'consumables' | 'menu';

export interface StockTab {
  id: BarSection;
  href: string;
  label: string;
}
export interface StockGroup {
  id: 'overview' | 'bar' | 'kitchen' | 'purchases' | 'operations';
  label: string;
  /** первая вкладка группы: куда ведёт верхняя вкладка */
  tabs: StockTab[];
}

export function stockGroupsFor(vertical: WebVertical): StockGroup[] {
  // у ресторана «Кухня» склада на `/stock` (его «Кухня» в «Услугах» это экран заказов), «Меню» в «Услугах»
  const food = vertical === 'FOOD_SERVICE';
  return [
    { id: 'overview', label: msg('Обзор'), tabs: [{ id: 'warehouse', href: '/warehouse', label: msg('Обзор склада') }] },
    {
      id: 'bar',
      // товары на продажу: «Бар» у всех направлений (слово из `vertical-copy.ts`)
      label: verticalCopy(vertical).menu.goods,
      tabs: [
        { id: 'bar', href: '/bar', label: msg('Товары') },
        ...(food ? [] : [{ id: 'menu' as const, href: '/bar/menu', label: msg('Меню бара') }]),
        { id: 'products', href: '/bar/products', label: msg('Номенклатура') },
      ],
    },
    {
      id: 'kitchen',
      label: msg('Кухня'),
      tabs: [{ id: 'consumables', href: food ? '/stock' : '/bar/consumables', label: msg('Кухня') }],
    },
    {
      id: 'purchases',
      label: msg('Закупки'),
      tabs: [
        { id: 'receipts', href: '/bar/receipts', label: msg('Приходы') },
        { id: 'suppliers', href: '/bar/suppliers', label: msg('Поставщики') },
      ],
    },
    { id: 'operations', label: msg('Движение'), tabs: [{ id: 'operations', href: '/bar/operations', label: msg('Движение товаров') }] },
  ];
}

/** Все адреса склада подряд (для проверок и мобильного списка) */
export function barSectionsFor(vertical: WebVertical): StockTab[] {
  return stockGroupsFor(vertical).flatMap((g) => g.tabs);
}

export function BarTabs({ current }: { current: BarSection }) {
  const vertical = useDeskVertical();
  const t = useT();
  const groups = stockGroupsFor(vertical);
  const active = groups.find((g) => g.tabs.some((tab) => tab.id === current)) ?? groups[0]!;
  return (
    <div className="stock-tabs" data-testid="stock-tabs">
      <nav className="glass-tabs" aria-label={t('Разделы склада')}>
        {groups.map((g) => (
          <Link key={g.id} href={g.tabs[0]!.href} aria-current={g.id === active.id ? 'page' : undefined}>
            {t(g.label)}
          </Link>
        ))}
      </nav>
      {active.tabs.length > 1 && (
        <nav className="glass-tabs glass-tabs--sub" aria-label={t(active.label)}>
          {active.tabs.map((tab) => (
            <Link key={tab.id} href={tab.href} aria-current={tab.id === current ? 'page' : undefined}>
              {t(tab.label)}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
