import type { Db, DbTx } from '@pms/database';
import type { InventoryImportPlan } from '@pms/domain';

/** Фонд из БД в форме плана — чтобы сверять одной и той же функцией summarizeInventoryPlan. */
export async function readInventoryPlanFromDb(
  db: Db | DbTx,
  propertyName: string,
  /** Дата, на которую считаются действующие блокировки (YYYY-MM-DD); по умолчанию сегодня в Алматы */
  blocksOnDate: string = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10),
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
  // Читаем ВСЕ здания и этажи, а не первое из каждого. Иначе единица, заведённая под другим зданием
  // или этажом, невидима и для экрана фонда, и для сверки Gate 1 — а отчёт всё равно печатает
  // «88 / 88 / 0», потому что обе стороны считаются одной и той же функцией.
  const units = property.buildings
    .flatMap((b) => b.floors)
    .flatMap((f) => f.physicalRooms)
    .flatMap((room) =>
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
  // Блокировки считаем ДЕЙСТВУЮЩИЕ на контрольную дату: Exely в сверке даёт «заблокировано на дату»,
  // а не «сколько записей о блокировках было за всю историю» (иначе Gate 1 сломается после первой блокировки)
  const onDate = new Date(`${blocksOnDate}T00:00:00Z`);
  const blocks = await db.inventoryBlock.count({
    where: {
      inventoryUnit: { accommodationType: { propertyId: property.id } },
      dateFrom: { lte: onDate },
      dateTo: { gt: onDate },
    },
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
