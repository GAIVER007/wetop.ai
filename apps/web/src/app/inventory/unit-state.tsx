import type { InventoryUnit } from '../../lib/api';
import { BADGE_TONE, Badge } from '../../components/ui';
import { housekeepingStatus } from '../../lib/status/housekeeping';
import { Icon } from '../../components/icon';
import { displayDate } from '../../lib/display-date';
import { blockTypeLabel } from '../../lib/block-types';
import { msg, translator, type Translate } from '../../i18n';
import { T } from '../../i18n/locale-provider';

const RU = translator('ru');

/**
 * Состояние и уборка места одними словами в таблице фонда и в панели места (ADR-108, срезы I1–I2).
 * Уборка — значок и слово (DESIGN.md §7, §9); блокировка — «до даты, причина», причина словом блокировки.
 */

export function UnitStateBadge({ active, block }: Pick<InventoryUnit, 'active' | 'block'>) {
  if (!active) return (
      <Badge>
        <T text={msg('в архиве')} />
      </Badge>
    );
  if (block)
    return (
      <span className="inventory-state">
        <Badge tone="danger">
          <T text={msg('заблокирована')} />
        </Badge>
        <span className="inventory-state-note">
          <time dateTime={block.dateTo}>
            <T text={msg('до {date}')} vars={{ date: displayDate(block.dateTo, 'numeric') }} />
          </time>
          {', '}
          {block.reason || <T text={blockTypeLabel(block.type)} />}
        </span>
      </span>
    );
  return (
    <Badge tone="ok">
      <T text={msg('в продаже')} />
    </Badge>
  );
}

export function HousekeepingBadge({ status }: { status: InventoryUnit['housekeepingStatus'] }) {
  return (
    <Badge tone={BADGE_TONE[housekeepingStatus[status].tone]} className="inventory-hk">
      <Icon name={housekeepingStatus[status].icon} width={14} height={14} />
      <T text={housekeepingStatus[status].label} />
    </Badge>
  );
}

/**
 * Этаж словами без повторов (аудит 22.10.2026 P1-17: было «этаж 1 этаж»): число → «2 этаж», название, где слово
 * «этаж» уже есть или это не число («Мансарда»), остаётся как ввели.
 */
export function floorText(floorName: string, t: Translate = RU): string {
  const name = floorName.trim();
  return /^-?\d+$/.test(name) ? t('{n} этаж', { n: name }) : name;
}

/** «Основной корпус» как ввели; одна буква или номер («Б», «2») подписывается словом «Корпус Б» */
export function buildingText(buildingName: string, t: Translate = RU): string {
  const name = buildingName.trim();
  return /корпус/i.test(name) ? name : t('Корпус {name}', { name }); // kk-allow: сверка с введённым названием корпуса
}

/** «2 этаж, комната 201» — комната не пишется, когда повторяет код места (ТЗ §11) */
export function floorRoomText(
  unit: {
    code: string;
    floorName: string | null;
    roomNumber: string;
  },
  t: Translate = RU,
) {
  return [
    unit.floorName ? floorText(unit.floorName, t) : '',
    unit.roomNumber && unit.roomNumber !== unit.code ? t('комната {n}', { n: unit.roomNumber }) : '',
  ]
    .filter(Boolean)
    .join(', ');
}

/** Расположение одной строкой: «Основной корпус, 1 этаж» */
export function placeText(
  unit: {
    buildingName: string | null;
    code: string;
    floorName: string | null;
    roomNumber: string;
  },
  t: Translate = RU,
) {
  return [unit.buildingName ? buildingText(unit.buildingName, t) : '', floorRoomText(unit, t)]
    .filter(Boolean)
    .join(', ');
}
