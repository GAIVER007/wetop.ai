import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import type { IntegrationFacts, ReservationCardLike } from '@pms/domain';
import { isIntegrationActor } from '../channels/integration-owner';
import { PrismaService } from '../database/prisma.provider';
import { loadReservationCard } from '../reservations/reservation-card';

export const DIAGNOSTICS_REPOSITORY = Symbol('DIAGNOSTICS_REPOSITORY');

const PROVIDER = 'channex';

/** Факты каналов без снимка сторожа webhook: его держит сервис каналов в памяти, не база */
export type IntegrationDbFacts = Omit<IntegrationFacts, 'webhook' | 'keyConfigured'>;

/**
 * Факты для диагностики WETOP Support (S5). Читаются от имени организации запроса (`withSignedInUser` ставит
 * сервис), поэтому под RLS база и сама не отдаст чужого. Имя, телефон и заметки из карточки брони сюда попадают,
 * но дальше сборка домена читает только перечисленные поля.
 */
export interface DiagnosticsRepository {
  /** `null` — к этой организации каналы не подключены (интеграция одна на установку, `isIntegrationActor`) */
  integrationFacts(organizationId: string): Promise<IntegrationDbFacts | null>;
  /** Бронь с этим номером среди объектов организации; `null` — нет такой или чужая, без различения */
  reservationCard(
    organizationId: string,
    confirmationNumber: string,
  ): Promise<{ card: ReservationCardLike; timezone: string } | null>;
}

@Injectable()
export class PrismaDiagnosticsRepository implements DiagnosticsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async integrationFacts(organizationId: string): Promise<IntegrationDbFacts | null> {
    if (!(await isIntegrationActor(this.prisma, { organizationId }))) return null;
    const db = this.prisma.db;
    const property = await db.property.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!property) return null;
    const propertyId = property.id;
    const [mappings, categoriesTotal, lastEvent, pending, failed, oldest] = await Promise.all([
      db.channelMapping.findMany({
        where: { provider: PROVIDER, propertyId },
        select: { providerPropertyId: true, providerRoomTypeId: true, providerRatePlanId: true },
      }),
      db.accommodationType.count({ where: { propertyId, active: true } }),
      db.externalEvent.findFirst({
        where: { provider: PROVIDER, propertyId, receivedVia: { in: ['WEBHOOK', 'PULL'] } },
        orderBy: { receivedAt: 'desc' },
        select: { receivedAt: true },
      }),
      db.channelOutbox.count({ where: { provider: PROVIDER, propertyId, status: 'PENDING' } }),
      db.channelOutbox.count({ where: { provider: PROVIDER, propertyId, status: 'FAILED' } }),
      db.channelOutbox.findFirst({
        where: { provider: PROVIDER, propertyId, status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);
    return {
      propertyMapped: mappings.some((m) => !!m.providerPropertyId),
      categoriesTotal,
      categoriesMapped: new Set(mappings.map((m) => m.providerRoomTypeId).filter(Boolean)).size,
      ratePlansMapped: new Set(mappings.map((m) => m.providerRatePlanId).filter(Boolean)).size,
      lastEventAt: lastEvent?.receivedAt ?? null,
      outbox: { pending, failed, oldestPendingAt: oldest?.createdAt ?? null },
    };
  }

  async reservationCard(organizationId: string, confirmationNumber: string) {
    const db = this.prisma.db;
    const found = await db.reservation.findFirst({
      where: { confirmationNumber, property: { organizationId } },
      select: { propertyId: true, property: { select: { timezone: true } } },
    });
    if (!found) return null;
    const card = await loadReservationCard(db, found.propertyId, confirmationNumber);
    return card ? { card, timezone: found.property.timezone } : null;
  }
}
