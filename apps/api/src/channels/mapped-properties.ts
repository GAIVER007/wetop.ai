import type { Db } from '@pms/database';

export interface MappedChannexProperty {
  localPropertyId: string;
  providerPropertyId: string;
}

/** Only verified property-level mappings may route a Channex job. */
export async function mappedChannexProperties(db: Db): Promise<MappedChannexProperty[]> {
  const rows = await db.channelMapping.findMany({
    where: {
      provider: 'channex',
      localAccommodationTypeId: null,
      localRatePlanId: null,
      providerRoomTypeId: null,
      providerRatePlanId: null,
    },
    select: { propertyId: true, providerPropertyId: true },
  });
  const local = new Map<string, string>();
  const external = new Map<string, string>();
  for (const row of rows) {
    if (
      (local.has(row.propertyId) && local.get(row.propertyId) !== row.providerPropertyId) ||
      (external.has(row.providerPropertyId) && external.get(row.providerPropertyId) !== row.propertyId)
    ) throw new Error('У объекта Channex несколько несовместимых сопоставлений: синхронизация остановлена');
    local.set(row.propertyId, row.providerPropertyId);
    external.set(row.providerPropertyId, row.propertyId);
  }
  return [...local.entries()].map(([localPropertyId, providerPropertyId]) => ({
    localPropertyId,
    providerPropertyId,
  }));
}

export async function localPropertyForChannex(db: Db, providerPropertyId: string): Promise<string | null> {
  const rows = await mappedChannexProperties(db);
  return rows.find((row) => row.providerPropertyId === providerPropertyId)?.localPropertyId ?? null;
}
