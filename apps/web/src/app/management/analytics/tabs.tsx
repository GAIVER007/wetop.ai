import type { DashboardFund } from '@pms/domain';
import { ANALYTICS_PATH } from './params';
import { Tabs } from '../../../components/tabs';
import { serverT } from '../../../i18n/server';

/**
 * Вкладки модуля «Аналитика» (ADR-114): ссылки с `aria-current`, общий `Tabs` маршрутами.
 * Тип фонда переходит между вкладками, период — нет: у «Обзора» по умолчанию месяц, у «Загрузки» — день.
 * «Брони», «Продажи» и «Категории» появятся срезами AN3–AN5 — пустых заглушек нет.
 */
export async function AnalyticsTabs({
  current,
  fund = 'all',
}: {
  current: 'overview' | 'occupancy' | 'units' | 'channels';
  fund?: DashboardFund;
}) {
  const q = fund === 'all' ? '' : `?fund=${fund}`;
  const t = await serverT();
  const tabs = [
    { id: 'overview', label: t('Обзор'), href: `${ANALYTICS_PATH}${q}` },
    { id: 'occupancy', label: t('Загрузка'), href: `${ANALYTICS_PATH}/occupancy${q}` },
    { id: 'units', label: t('По номерам'), href: `${ANALYTICS_PATH}/units${q}` },
    // «Эффективность каналов» (ADR-141): у неё свой период заезда и сравнение, тип фонда не переходит
    { id: 'channels', label: t('Каналы'), href: `${ANALYTICS_PATH}/channels` },
  ] as const;
  return (
    <div data-testid="pa-tabs">
      <Tabs
        label={t('Аналитика')}
        items={tabs.map((tab) => ({ href: tab.href, label: tab.label, current: tab.id === current }))}
      />
    </div>
  );
}
