import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Db } from '@pms/database';
import {
  hasVerticalCapability,
  parseBusinessVertical,
  type BusinessVertical,
  type VerticalCapability,
} from '@pms/domain';

/** Reads an active Business only inside the verified organization. */
export async function resolveBusinessVertical(
  db: Pick<Db, 'business'>,
  organizationId: string,
  businessId: string,
): Promise<BusinessVertical> {
  const business = await db.business.findFirst({
    where: { id: businessId, organizationId, status: 'ACTIVE' },
    select: { vertical: true },
  });
  const vertical = parseBusinessVertical(business?.vertical);
  if (!vertical) throw new NotFoundException('Бизнес недоступен');
  return vertical;
}
export function assertBusinessCapability(
  vertical: BusinessVertical,
  capability: VerticalCapability,
): void {
  if (!hasVerticalCapability(vertical, capability))
    throw new ForbiddenException('Раздел недоступен для этого направления бизнеса');
}
