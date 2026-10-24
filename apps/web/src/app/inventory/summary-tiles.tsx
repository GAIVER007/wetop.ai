'use client';
import type { InventoryUnit } from '../../lib/api';
import { useT } from '../../i18n/locale-provider';
import { SummaryLine } from '../../lib/summary-line';

/**
 * Итоги «Номерного фонда» одной строкой (аудит 22.10.2026 P1-17): шесть плиток со стрелками динамики сняты,
 * владелец против плиток на всех экранах. Числа считаются из того же списка мест, testid прежние.
 */
export function InventorySummaryLine({ units }: { units: InventoryUnit[] }) {
  const t = useT();
  const rooms = units.filter((u) => u.kind === 'ROOM').length;
  const beds = units.length - rooms;
  const onSale = units.filter((u) => u.active && !u.block).length;
  const blocked = units.filter((u) => u.active && u.block).length;
  const dirty = units.filter((u) => u.active && u.housekeepingStatus === 'DIRTY').length;
  return (
    <SummaryLine
      label={t('Сводка фонда')}
      testId="inventory-summary"
      parts={[
        { key: 'total', label: t('Всего мест'), value: units.length, testId: 'total-units' },
        { key: 'rooms', label: t('номеров'), value: rooms, testId: 'rooms' },
        { key: 'beds', label: t('койко-мест'), value: beds, testId: 'beds' },
        { key: 'on-sale', label: t('в продаже'), value: onSale, testId: 'on-sale' },
        { key: 'blocks', label: t('недоступно'), value: blocked, testId: 'blocks' },
        { key: 'dirty', label: t('требует уборки'), value: dirty, testId: 'needs-cleaning' },
      ]}
    />
  );
}
