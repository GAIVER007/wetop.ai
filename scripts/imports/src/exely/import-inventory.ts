import type { DbTx } from '@pms/database';
import type { InventoryImportPlan } from '@pms/domain';
import type { PropertySpec } from './property';

export interface EntityCounts {
  created: number;
  updated: number;
}

export interface InventoryImportReport {
  propertyId: string;
  property: EntityCounts;
  buildings: EntityCounts;
  floors: EntityCounts;
  accommodationTypes: EntityCounts;
  physicalRooms: EntityCounts;
  units: EntityCounts;
  /** Итог в БД после импорта — для сравнения с планом */
  unitsInDb: number;
}

const zero = (): EntityCounts => ({ created: 0, updated: 0 });

/**
 * Идемпотентный импорт фонда: вызывать ВНУТРИ одной транзакции (`db.$transaction`).
 * Ключи идемпотентности: Property.name; Building (property, name); Floor (building, name);
 * AccommodationType (property, code); PhysicalRoom (floor, room_number); InventoryUnit.code.
 * Повторный запуск с тем же планом ничего не создаёт — только обновляет.
 * Из номера единицы ничего не выводится: kind, категория, вместимость приходят из плана.
 */
export async function importInventoryPlan(
  tx: DbTx,
  plan: InventoryImportPlan,
  property: PropertySpec,
): Promise<InventoryImportReport> {
  const report: InventoryImportReport = {
    propertyId: '',
    property: zero(),
    buildings: zero(),
    floors: zero(),
    accommodationTypes: zero(),
    physicalRooms: zero(),
    units: zero(),
    unitsInDb: 0,
  };

  // Property — по name (single-property MVP; уникального бизнес-ключа в схеме нет)
  const existingProperty = await tx.property.findFirst({ where: { name: property.name } });
  // Новый объект — самой старой организации, как привязка в миграции …16; организаций нет — своя по имени объекта
  // (DATA_MODEL v1.13: у объекта организация обязательна)
  const organizationId = existingProperty
    ? existingProperty.organizationId
    : ((await tx.organization.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } }))?.id ??
      (await tx.organization.create({ data: { name: property.name, status: 'ACTIVE' }, select: { id: true } })).id);
  const prop = existingProperty
    ? await tx.property.update({ where: { id: existingProperty.id }, data: property })
    : await tx.property.create({ data: { ...property, organizationId } });
  if (existingProperty) report.property.updated += 1;
  else report.property.created += 1;
  report.propertyId = prop.id;

  const existingBuilding = await tx.building.findUnique({
    where: { propertyId_name: { propertyId: prop.id, name: plan.buildingName } },
  });
  const building =
    existingBuilding ??
    (await tx.building.create({ data: { propertyId: prop.id, name: plan.buildingName } }));
  if (existingBuilding) report.buildings.updated += 1;
  else report.buildings.created += 1;

  const existingFloor = await tx.floor.findUnique({
    where: { buildingId_name: { buildingId: building.id, name: plan.floorName } },
  });
  const floor =
    existingFloor ??
    (await tx.floor.create({ data: { buildingId: building.id, name: plan.floorName } }));
  if (existingFloor) report.floors.updated += 1;
  else report.floors.created += 1;

  const typeIdByCode = new Map<string, string>();
  for (const t of plan.accommodationTypes) {
    const where = { propertyId_code: { propertyId: prop.id, code: t.code } };
    const data = {
      name: t.name,
      kind: t.kind,
      capacityAdults: t.capacityAdults,
      capacityChildren: t.capacityChildren,
      exelyId: t.exelyId,
      active: true,
    };
    const existing = await tx.accommodationType.findUnique({ where });
    const saved = existing
      ? await tx.accommodationType.update({ where, data })
      : await tx.accommodationType.create({ data: { propertyId: prop.id, code: t.code, ...data } });
    if (existing) report.accommodationTypes.updated += 1;
    else report.accommodationTypes.created += 1;
    typeIdByCode.set(t.code, saved.id);
  }

  for (const u of plan.units) {
    const typeId = typeIdByCode.get(u.accommodationTypeCode);
    if (typeId === undefined) {
      throw new Error(`Unit ${u.code}: accommodation type ${u.accommodationTypeCode} not in plan`);
    }
    const roomWhere = { floorId_roomNumber: { floorId: floor.id, roomNumber: u.roomNumber } };
    const roomData = { capacity: u.roomCapacity, isDorm: u.isDorm };
    const existingRoom = await tx.physicalRoom.findUnique({ where: roomWhere });
    const room = existingRoom
      ? await tx.physicalRoom.update({ where: roomWhere, data: roomData })
      : await tx.physicalRoom.create({
          data: { floorId: floor.id, roomNumber: u.roomNumber, ...roomData },
        });
    if (existingRoom) report.physicalRooms.updated += 1;
    else report.physicalRooms.created += 1;

    const unitData = {
      propertyId: prop.id,
      physicalRoomId: room.id,
      accommodationTypeId: typeId,
      kind: u.kind,
      exelyRoomNumber: u.exelyRoomNumber,
      active: true,
    };
    const unitKey = { propertyId_code: { propertyId: prop.id, code: u.code } };
    const existingUnit = await tx.inventoryUnit.findUnique({ where: unitKey });
    if (existingUnit) {
      await tx.inventoryUnit.update({ where: unitKey, data: unitData });
      report.units.updated += 1;
    } else {
      await tx.inventoryUnit.create({ data: { code: u.code, ...unitData } });
      report.units.created += 1;
    }
  }

  report.unitsInDb = await tx.inventoryUnit.count({
    where: { accommodationType: { propertyId: prop.id } },
  });
  if (report.unitsInDb !== plan.units.length) {
    throw new Error(
      `После импорта в БД ${report.unitsInDb} единиц, в плане ${plan.units.length} — транзакция откатывается`,
    );
  }

  await tx.auditLog.create({
    data: {
      entityType: 'Property',
      entityId: prop.id,
      action: 'inventory.import',
      after: JSON.parse(JSON.stringify(report)),
    },
  });
  return report;
}
