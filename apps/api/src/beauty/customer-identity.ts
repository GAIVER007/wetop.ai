import type { DbTx } from '@pms/database';

type CustomerLockDb = Pick<DbTx, '$queryRaw'>;

export async function lockBeautyCustomerPhone(
  tx: CustomerLockDb,
  organizationId: string,
  normalizedPhone: string,
): Promise<void> {
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${`${organizationId}:${normalizedPhone}`}, 947)
    ) IS NULL AS locked
  `;
}

export async function lockBeautyCustomerPhones(
  tx: CustomerLockDb,
  organizationId: string,
  normalizedPhones: readonly string[],
): Promise<void> {
  const phones = [...new Set(normalizedPhones)].sort();
  for (const phone of phones) await lockBeautyCustomerPhone(tx, organizationId, phone);
}
