'use client';
import { Tabs } from '../../components/tabs';
import { msg } from '../../i18n';
import { useT } from '../../i18n/locale-provider';

export type ReportsTab = 'overview' | 'occupancy' | 'units' | 'finance' | 'channels' | 'documents';

/**
 * Вкладки раздела «Отчёты» (RPT2.2c-1, `plans/reports-2-0-overview-2026-10-09.md`). «Обзор», «Загрузка» и
 * «По номерам» отдают те же экраны, что «Аналитика», под адресами `/reports/*`; «Каналы» пока живут на своём
 * адресе; «Все отчёты» это хаб карточек (корень `/reports`), первой вкладкой, как пункт меню.
 * Пустых вкладок нет.
 */
export function ReportsTabs({ current, fund = 'all' }: { current: ReportsTab; fund?: string }) {
  const t = useT();
  const q = fund === 'all' ? '' : `?fund=${fund}`;
  const items: { id: ReportsTab; label: string; href: string }[] = [
    // Хаб всех карточек первым и тем же словом, что пункт меню «Все отчёты» (13.10.2026: раньше «Документы»)
    { id: 'documents', label: msg('Все отчёты'), href: '/reports' },
    { id: 'overview', label: msg('Обзор'), href: `/reports/overview${q}` },
    { id: 'occupancy', label: msg('Загрузка'), href: `/reports/occupancy${q}` },
    { id: 'units', label: msg('По номерам'), href: `/reports/units${q}` },
    { id: 'finance', label: msg('Финансы'), href: '/reports/finance' },
    { id: 'channels', label: msg('Каналы'), href: '/management/analytics/channels' },
  ];
  return (
    <Tabs
      label={t('Отчёты')}
      items={items.map((item) => ({ href: item.href, label: t(item.label), current: item.id === current }))}
    />
  );
}
