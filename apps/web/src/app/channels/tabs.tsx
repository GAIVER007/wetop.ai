import { Tabs } from '../../components/tabs';

export const CHANNEL_TABS = [
  { view: '', href: '/channels', label: 'Обзор' },
  // Раздел «Каналы» (ADR-140): подключённые и все доступные каналы Channex — как в прежней системе
  { view: 'list', href: '/channels/list', label: 'Каналы' },
  { view: 'connections', href: '/connections/channex', label: 'Настройка подключения' },
  { view: 'mapping', href: '/channels/mapping', label: 'Сопоставление' },
  { view: 'sync', href: '/channels/sync', label: 'Синхронизация' },
  { view: 'events', href: '/channels/events', label: 'События' },
] as const;

/** Вкладки «Каналов продаж»: одни и те же на всех экранах раздела, включая «Настройку подключения» */
export function ChannelTabs({ current }: { current: string }) {
  return (
    <Tabs
      label="Каналы продаж"
      items={CHANNEL_TABS.map((item) => ({ href: item.href, label: item.label, current: item.view === current }))}
    />
  );
}
