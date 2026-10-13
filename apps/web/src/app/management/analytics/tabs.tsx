import type { DashboardFund } from '@pms/domain';
import { ANALYTICS_PATH } from './params';
import { Tabs } from '../../../components/tabs';

/**
 * Вкладки модуля «Аналитика» (ADR-114): ссылки с `aria-current`, общий `Tabs` маршрутами.
 * Тип фонда переходит между вкладками, период — нет: у «Обзора» по умолчанию месяц, у «Загрузки» — день.
 * «Брони», «Продажи» и «Категории» появятся срезами AN3–AN5 — пустых заглушек нет.
 */
export function AnalyticsTabs({
  current,
  fund = 'all',
}: {
  current: 'overview' | 'occupancy' | 'units' | 'channels';
  fund?: DashboardFund;
}) {
  const q = fund === 'all' ? '' : `?fund=${fund}`;
  const tabs = [
    { id: 'overview', label: 'Обзор', href: `${ANALYTICS_PATH}${q}` },
    { id: 'occupancy', label: 'Загрузка', href: `${ANALYTICS_PATH}/occupancy${q}` },
    { id: 'units', label: 'По номерам', href: `${ANALYTICS_PATH}/units${q}` },
    // «Эффективность каналов» (ADR-141): у неё свой период заезда и сравнение, тип фонда не переходит
    { id: 'channels', label: 'Каналы', href: `${ANALYTICS_PATH}/channels` },
  ] as const;
  return (
    <div data-testid="pa-tabs">
      <Tabs
        label="Аналитика"
        items={tabs.map((t) => ({ href: t.href, label: t.label, current: t.id === current }))}
      />
    </div>
  );
}
