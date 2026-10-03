import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { accessDeniedMessage, type Permission } from '@pms/domain';
import {
  actorMay,
  currentBusinessId,
  currentLocationId,
  currentOrganizationId,
  hasSignedInActor,
} from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';

/** Общее для модулей салона: где мы находимся и можно ли (DATA_MODEL §19, срезы B3 и B4) */

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Салон вошедшего: бизнес BEAUTY его организации и выбранный филиал, если он есть */
export interface BeautyScope {
  organizationId: string;
  businessId: string;
  /** Филиал из указателя запроса; его нет, когда человек смотрит организацию целиком */
  locationId: string | null;
  locationName: string | null;
  locationCurrency: string | null;
  /** IANA-пояс филиала: день недели и время графика считаются по нему (AGENTS.md §13) */
  locationTimezone: string | null;
}

export function mayBeauty(permission: Permission): void {
  if (!hasSignedInActor() || !actorMay(permission))
    throw new ForbiddenException(accessDeniedMessage(permission));
}

/**
 * Где мы находимся. Бизнес берётся из указателя запроса (Platform P2 К1), а без указателя это
 * единственный действующий бизнес BEAUTY организации: у салона на одном филиале указателя нет.
 */
export async function beautyScope(prisma: PrismaService): Promise<BeautyScope> {
  const organizationId = currentOrganizationId();
  if (!hasSignedInActor() || !organizationId) throw new ForbiddenException('Войдите в организацию');
  const pointed = currentBusinessId();
  const business = await prisma.db.business.findFirst({
    where: {
      organizationId,
      vertical: 'BEAUTY',
      status: 'ACTIVE',
      ...(pointed ? { id: pointed } : {}),
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!business) throw new NotFoundException('Салон в этой организации не настроен');

  const locationId = currentLocationId();
  const select = { id: true, name: true, currency: true, timezone: true };
  const location = locationId
    ? await prisma.db.location.findFirst({
        where: { id: locationId, businessId: business.id, status: 'ACTIVE' },
        select,
      })
    : await prisma.db.location.findFirst({
        where: { businessId: business.id, status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
        select,
      });

  return {
    organizationId,
    businessId: business.id,
    locationId: location?.id ?? null,
    locationName: location?.name ?? null,
    locationCurrency: location?.currency ?? null,
    locationTimezone: location?.timezone ?? null,
  };
}
