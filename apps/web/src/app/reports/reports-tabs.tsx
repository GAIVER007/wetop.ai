import { Tabs } from '../../components/tabs';

export type ReportsTab = 'overview' | 'occupancy' | 'units' | 'finance' | 'channels' | 'documents';

/**
 * Вкладки раздела «Отчёты» (RPT2.2c-1, `plans/reports-2-0-overview-2026-10-09.md`). «Обзор», «Загрузка» и
 * «По номерам» отдают те же экраны, что «Аналитика», под адресами `/reports/*`; «Каналы» пока живут на своём
 * адресе; «Документы» это хаб карточек (корень `/reports`, пока гейт не прогнал UI-наборы на новый корень).
 * Пустых вкладок нет.
 */
export function ReportsTabs({ current, fund = 'all' }: { current: ReportsTab; fund?: string }) {
  const q = fund === 'all' ? '' : `?fund=${fund}`;
  const items: { id: ReportsTab; label: string; href: string }[] = [
    { id: 'overview', label: 'Обзор', href: `/reports/overview${q}` },
    { id: 'occupancy', label: 'Загрузка', href: `/reports/occupancy${q}` },
    { id: 'units', label: 'По номерам', href: `/reports/units${q}` },
    { id: 'finance', label: 'Финансы', href: '/reports/finance' },
    { id: 'channels', label: 'Каналы', href: '/management/analytics/channels' },
    { id: 'documents', label: 'Документы', href: '/reports' },
  ];
  return (
    <Tabs
      label="Отчёты"
      items={items.map((t) => ({ href: t.href, label: t.label, current: t.id === current }))}
    />
  );
}
