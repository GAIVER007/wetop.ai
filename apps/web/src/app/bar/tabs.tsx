import { Tabs } from '../../components/tabs';

/**
 * Вкладки раздела «Бар» (ADR-156): пять подстраниц вместо одного полотна. «Новый приход» живёт под
 * «Приходами» и своей вкладки не имеет. Право у всех одно: пункт меню `/bar` (`routeRule`).
 */
export type BarSection = 'overview' | 'receipts' | 'products' | 'suppliers' | 'operations';

const SECTIONS: Array<{ id: BarSection; href: string; label: string }> = [
  { id: 'overview', href: '/bar', label: 'Обзор' },
  { id: 'receipts', href: '/bar/receipts', label: 'Приходы' },
  { id: 'products', href: '/bar/products', label: 'Товары' },
  { id: 'suppliers', href: '/bar/suppliers', label: 'Поставщики' },
  { id: 'operations', href: '/bar/operations', label: 'Операции' },
];

export function BarTabs({ current }: { current: BarSection }) {
  return (
    <Tabs
      label="Разделы бара"
      className="bar-tabs"
      items={SECTIONS.map((section) => ({
        href: section.href,
        label: section.label,
        current: section.id === current,
      }))}
    />
  );
}
