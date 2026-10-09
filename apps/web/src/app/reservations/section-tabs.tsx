import { Tabs } from '../../components/tabs';

/**
 * «Брони» и «Гости» стали одним разделом меню (поручение владельца 09.10.2026): в шапке одна
 * вкладка «Брони», а между списком броней и базой гостей ведут эти вкладки на самих страницах.
 * Адреса (/reservations, /guests) и права страниц не менялись; примитив: Tabs (DESIGN.md §8.1).
 */
export function SectionTabs({ current }: { current: '/reservations' | '/guests' }) {
  return (
    <Tabs
      label="Брони и гости"
      items={[
        { href: '/reservations', label: 'Брони', current: current === '/reservations' },
        { href: '/guests', label: 'Гости', current: current === '/guests' },
      ]}
    />
  );
}
