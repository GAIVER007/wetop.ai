import type { Db, DbTx } from '@pms/database';
import type { InventoryImportPlan } from '@pms/domain';

/** Фонд из БД в форме плана — чтобы сверять одной и той же функцией summarizeInventoryPlan. */
export async function readInventoryPlanFromDb(
  db: Db | DbTx,
  propertyName: string,
): Promise<{ plan: InventoryImportPlan; blocks: number } | null> {
  const property = await db.property.findFirst({
    where: { name: propertyName },
    include: {
      accommodationTypes: true,
      buildings: {
        include: { floors: { include: { physicalRooms: { include: { units: true } } } } },
      },
    },
  });
  if (!property) return null;
  const building = property.buildings[0];
  const floor = building?.floors[0];
  const units = (floor?.physicalRooms ?? []).flatMap((room) =>
    room.units.map((u) => ({
      code: u.code,
      exelyRoomNumber: u.exelyRoomNumber,
      kind: u.kind,
      accommodationTypeCode:
        property.accommodationTypes.find((t) => t.id === u.accommodationTypeId)?.code ?? '?',
      roomNumber: room.roomNumber,
      roomCapacity: room.capacity,
      isDorm: room.isDorm,
    })),
  );
  const blocks = await db.inventoryBlock.count({
    where: { inventoryUnit: { accommodationType: { propertyId: property.id } } },
  });
  return {
    plan: {
      buildingName: building?.name ?? '',
      floorName: floor?.name ?? '',
      accommodationTypes: property.accommodationTypes.map((t) => ({
        code: t.code,
        name: t.name,
        kind: t.kind,
        capacityAdults: t.capacityAdults,
        capacityChildren: t.capacityChildren,
        exelyId: t.exelyId,
      })),
      units,
    },
    blocks,
  };
}
