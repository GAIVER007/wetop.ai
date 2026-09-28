import Link from 'next/link';

/**
 * Вкладки «Каналов продаж» (ТЗ §2, ADR-107). Вкладка появляется вместе со своим этапом: CH1 — обзор,
 * CH2 — сопоставление; «Подключения», «Синхронизация» и «События» — позже, до тех пор они живут на
 * `/channels` и `/connections`.
 */
const TABS = [
  { href: '/channel-manager', label: 'Обзор', view: 'overview' },
  { href: '/channel-manager/mapping', label: 'Сопоставление', view: 'mapping' },
] as const;

export function ChannelTabs({ current }: { current: (typeof TABS)[number]['view'] }) {
  return (
    <nav className="settings-tabs" aria-label="Каналы продаж">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.view === current ? 'page' : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
