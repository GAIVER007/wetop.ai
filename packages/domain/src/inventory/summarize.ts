import type { InventoryCategorySummary, InventoryImportPlan, InventorySummary } from './types';

/**
 * Контрольные числа фонда: 88 = 16 ROOM + 72 BED, 92 гостя (PLAN.md Gate 1).
 * Максимум гостей = сумма вместимости единиц: у койки 1, у номера — вместимость комнаты.
 */
export function summarizeInventoryPlan(plan: InventoryImportPlan): InventorySummary {
  const byCode = new Map<string, InventoryCategorySummary>();
  for (const t of plan.accommodationTypes) {
    byCode.set(t.code, { code: t.code, name: t.name, units: 0, maxGuests: 0 });
  }
  let rooms = 0;
  let beds = 0;
  let maxGuests = 0;
  const physicalRooms = new Set<string>();
  for (const u of plan.units) {
    if (u.kind === 'ROOM') rooms += 1;
    else beds += 1;
    const guests = u.kind === 'BED' ? 1 : u.roomCapacity;
    maxGuests += guests;
    physicalRooms.add(u.roomNumber);
    const cat = byCode.get(u.accommodationTypeCode);
    if (cat === undefined) {
      throw new Error(`Unit ${u.code}: unknown accommodation type code ${u.accommodationTypeCode}`);
    }
    cat.units += 1;
    cat.maxGuests += guests;
  }
  return {
    totalUnits: plan.units.length,
    rooms,
    beds,
    maxGuests,
    physicalRooms: physicalRooms.size,
    byCategory: [...byCode.values()],
  };
}
