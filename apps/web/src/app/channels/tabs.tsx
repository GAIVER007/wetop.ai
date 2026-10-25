import { Tabs } from '../../components/tabs';
import { msg } from '../../i18n';
import { serverT } from '../../i18n/server';

export const CHANNEL_TABS = [
  { view: '', href: '/channels', label: msg('Обзор') },
  // Раздел «Каналы» (ADR-140): подключённые и все доступные каналы Channex — как в прежней системе
  { view: 'list', href: '/channels/list', label: msg('Каналы') },
  { view: 'connections', href: '/connections/channex', label: msg('Настройка подключения') },
  { view: 'mapping', href: '/channels/mapping', label: msg('Сопоставление') },
  { view: 'sync', href: '/channels/sync', label: msg('Синхронизация') },
  { view: 'events', href: '/channels/events', label: msg('События') },
] as const;

/** Вкладки «Каналов продаж»: одни и те же на всех экранах раздела, включая «Настройку подключения» */
export async function ChannelTabs({ current }: { current: string }) {
  const t = await serverT();
  return (
    <Tabs
      label={t('Каналы продаж')}
      items={CHANNEL_TABS.map((item) => ({ href: item.href, label: t(item.label), current: item.view === current }))}
    />
  );
}
