import type { AccommodationKind, InventoryImportPlan, InventoryUnitKind } from '@pms/domain';
import { ExelyImportError } from './errors';
import type { ExelyAccommodationType } from './parse-accommodation-types';
import type { ExelyInventoryExport } from './parse-inventory';

/** Соответствие «тип единицы ↔ тип категории». Нарушение — ошибка данных, не догадка. */
const KIND_OF_CATEGORY: Record<AccommodationKind, InventoryUnitKind | null> = {
  PRIVATE_ROOM: 'ROOM',
  DORM_BED: 'BED',
  APARTMENT: null, // на объекте нет; при появлении — отдельное решение
};

export function accommodationTypeCode(exelyId: string): string {
  return `exely-${exelyId}`;
}

/**
 * Собирает план импорта фонда из двух выгрузок Exely.
 * PhysicalRoom = 1:1 с единицей (ADR-013; Q-095 отложен). Из номера единицы ничего не выводится.
 */
export function buildInventoryImportPlan(
  inventory: ExelyInventoryExport,
  types: ExelyAccommodationType[],
): InventoryImportPlan {
  if (inventory.declaredTotal !== null && inventory.declaredTotal !== inventory.units.length) {
    throw new ExelyImportError(
      `Выгрузка заявляет ${inventory.declaredTotal} записей, а строк единиц ${inventory.units.length}`,
    );
  }
  const building = inventory.buildings[0];
  const floor = building?.floors[0];
  if (
    inventory.buildings.length !== 1 ||
    building === undefined ||
    building.floors.length !== 1 ||
    floor === undefined
  ) {
    throw new ExelyImportError(
      'Поддерживается ровно одно здание с одним этажом: в выгрузке Exely нет привязки единицы к этажу',
    );
  }

  const byName = new Map(types.map((t) => [t.name, t]));
  const units = inventory.units.map((u) => {
    const type = byName.get(u.categoryName);
    if (type === undefined) {
      throw new ExelyImportError(
        `Единица ${u.exelyRoomNumber}: категория «${u.categoryName}» не найдена в справочнике`,
      );
    }
    const expectedKind = KIND_OF_CATEGORY[type.kind];
    if (expectedKind !== u.kind) {
      throw new ExelyImportError(
        `Единица ${u.exelyRoomNumber}: тип ${u.kind} противоречит категории «${type.name}» (${type.kind})`,
      );
    }
    if (u.capacity > type.capacityAdults) {
      throw new ExelyImportError(
        `Единица ${u.exelyRoomNumber}: вместимость ${u.capacity} больше максимума категории ${type.capacityAdults}`,
      );
    }
    return {
      code: u.exelyRoomNumber,
      exelyRoomNumber: u.exelyRoomNumber,
      kind: u.kind,
      accommodationTypeCode: accommodationTypeCode(type.exelyId),
      roomNumber: u.exelyRoomNumber,
      roomCapacity: u.capacity,
      isDorm: u.kind === 'BED',
    };
  });

  return {
    buildingName: building.name,
    floorName: floor,
    accommodationTypes: types.map((t) => ({
      code: accommodationTypeCode(t.exelyId),
      name: t.name,
      kind: t.kind,
      capacityAdults: t.capacityAdults,
      capacityChildren: t.childrenWithoutBed,
      exelyId: t.exelyId,
    })),
    units,
  };
}
