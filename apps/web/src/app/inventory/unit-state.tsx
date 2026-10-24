import type { InventoryUnit } from '../../lib/api';
import { BADGE_TONE, Badge } from '../../components/ui';
import { housekeepingStatus } from '../../lib/status/housekeeping';
import { Icon } from '../../components/icon';
import { displayDate } from '../../lib/display-date';
import { blockTypeLabel } from '../../lib/block-types';

/**
 * Состояние и уборка места одними словами в таблице фонда и в панели места (ADR-108, срезы I1–I2).
 * Уборка — значок и слово (DESIGN.md §7, §9); блокировка — «до даты, причина», причина словом блокировки.
 */

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
    <Badge tone={BADGE_TONE[housekeepingStatus[status].tone]} className="inventory-hk">
      <Icon name={housekeepingStatus[status].icon} width={14} height={14} />
      {housekeepingStatus[status].label}
    </Badge>
  );
}

/**
 * Этаж словами без повторов (аудит 22.10.2026 P1-17: было «этаж 1 этаж»): число → «2 этаж», название, где слово
 * «этаж» уже есть или это не число («Мансарда»), остаётся как ввели.
 */
export function floorText(floorName: string): string {
  const name = floorName.trim();
  return /^-?\d+$/.test(name) ? `${name} этаж` : name;
}

/** «Основной корпус» как ввели; одна буква или номер («Б», «2») подписывается словом «Корпус Б» */
export function buildingText(buildingName: string): string {
  const name = buildingName.trim();
  return /корпус/i.test(name) ? name : `Корпус ${name}`;
}

/** «2 этаж, комната 201» — комната не пишется, когда повторяет код места (ТЗ §11) */
export function floorRoomText(unit: {
  code: string;
  floorName: string | null;
  roomNumber: string;
}) {
  return [
    unit.floorName ? floorText(unit.floorName) : '',
    unit.roomNumber && unit.roomNumber !== unit.code ? `комната ${unit.roomNumber}` : '',
  ]
    .filter(Boolean)
    .join(', ');
}

/** Расположение одной строкой: «Основной корпус, 1 этаж» */
export function placeText(unit: {
  buildingName: string | null;
  code: string;
  floorName: string | null;
  roomNumber: string;
}) {
  return [unit.buildingName ? buildingText(unit.buildingName) : '', floorRoomText(unit)]
    .filter(Boolean)
    .join(', ');
}
