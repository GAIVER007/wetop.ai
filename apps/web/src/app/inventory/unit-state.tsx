import type { InventoryUnit } from '../../lib/api';
import { Badge } from '../../components/ui';
import { Icon } from '../../components/icon';
import { displayDate } from '../../lib/display-date';
import { blockTypeLabel } from '../../lib/block-types';

/**
 * Состояние и уборка места одними словами в таблице фонда и в панели места (ADR-108, срезы I1–I2).
 * Уборка — значок и слово (DESIGN.md §7, §9); блокировка — «до даты, причина», причина словом блокировки.
 */
const HK_LABEL = {
  DIRTY: 'требует уборки',
  CLEAN: 'убрано',
  INSPECTED: 'проверено',
} as const;
const HK_TONE = { DIRTY: 'warn', CLEAN: 'neutral', INSPECTED: 'ok' } as const;
const HK_ICON = { DIRTY: 'dirty', CLEAN: 'clean', INSPECTED: 'inspected' } as const;

export function UnitStateBadge({ active, block }: Pick<InventoryUnit, 'active' | 'block'>) {
  if (!active) return <Badge>в архиве</Badge>;
  if (block)
    return (
      <span className="inventory-state">
        <Badge tone="danger">заблокирована</Badge>
        <span className="inventory-state-note">
          до <time dateTime={block.dateTo}>{displayDate(block.dateTo, 'numeric')}</time>
          {`, ${block.reason || blockTypeLabel(block.type)}`}
        </span>
      </span>
    );
  return <Badge tone="ok">в продаже</Badge>;
}

export function HousekeepingBadge({ status }: { status: InventoryUnit['housekeepingStatus'] }) {
  return (
    <Badge tone={HK_TONE[status]} className="inventory-hk">
      <Icon name={HK_ICON[status]} width={14} height={14} />
      {HK_LABEL[status]}
    </Badge>
  );
}

/** «этаж 2, комната 201» — комната не пишется, когда повторяет код места (ТЗ §11) */
export function floorRoomText(unit: { code: string; floorName: string | null; roomNumber: string }) {
  return [
    unit.floorName ? `этаж ${unit.floorName}` : '',
    unit.roomNumber && unit.roomNumber !== unit.code ? `комната ${unit.roomNumber}` : '',
  ]
    .filter(Boolean)
    .join(', ');
}
