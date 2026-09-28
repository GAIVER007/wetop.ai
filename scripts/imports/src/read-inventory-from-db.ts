import type { Db, DbTx } from '@pms/database';
import type { InventoryImportPlan } from '@pms/domain';

/** Фонд из БД в форме плана — чтобы сверять одной и той же функцией summarizeInventoryPlan. */
export async function readInventoryPlanFromDb(
  db: Db | DbTx,
  /** Какой объект читать: по имени (служебные ходоки, один объект) или по id (объект организации вошедшего) */
  where: { name: string } | { id: string },
  /** Дата, на которую считаются действующие блокировки (YYYY-MM-DD); по умолчанию сегодня в Алматы */
  blocksOnDate: string = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10),
): Promise<{
  plan: InventoryImportPlan;
  blocks: number;
  /** Сам объект: API держит дерево фонда в памяти и дальше считает только блокировки */
  property: { id: string; name: string; timezone: string; currency: string };
} | null> {
  const property = await db.property.findFirst({
    where,
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
    .flatMap((b) => b.floors.map((f) => ({ b, f })))
    .flatMap(({ b, f }) => f.physicalRooms.map((room) => ({ b, f, room })))
    .flatMap(({ b, f, room }) =>
      room.units.map((u) => ({
        code: u.code,
        kind: u.kind,
        accommodationTypeCode:
          property.accommodationTypes.find((t) => t.id === u.accommodationTypeId)?.code ?? '?',
        roomNumber: room.roomNumber,
        roomCapacity: room.capacity,
        isDorm: room.isDorm,
        buildingName: b.name,
        floorName: f.name,
      })),
    );
  // Блокировки считаем ДЕЙСТВУЮЩИЕ на контрольную дату,
  // а не «сколько записей о блокировках было за всю историю» (иначе Gate 1 сломается после первой блокировки)
  const blocks = await countActiveBlocks(db, property.id, blocksOnDate);
  return {
    property: {
      id: property.id,
      name: property.name,
      timezone: property.timezone,
      currency: property.currency,
    },
    plan: {
      buildingName: building?.name ?? '',
      floorName: floor?.name ?? '',
      accommodationTypes: property.accommodationTypes.map((t) => ({
        code: t.code,
        name: t.name,
        kind: t.kind,
        capacityAdults: t.capacityAdults,
        capacityChildren: t.capacityChildren,
      })),
      units,
    },
    blocks,
  };
}

/** Блокировки, действующие на дату (YYYY-MM-DD): одно правило для экрана фонда, API и сверки Gate 1 */
export function countActiveBlocks(
  db: Db | DbTx,
  propertyId: string,
  onDate: string,
): Promise<number> {
  const d = new Date(`${onDate}T00:00:00Z`);
  return db.inventoryBlock.count({
    where: {
      inventoryUnit: { accommodationType: { propertyId } },
      dateFrom: { lte: d },
      dateTo: { gt: d },
    },
  });
}
