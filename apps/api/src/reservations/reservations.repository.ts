import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import { isOverlapViolation, type Db, type DbTx } from '@pms/database';
import type { NightRate, ReservationSource, ReservationStatus } from '@pms/domain';
import { LUXX_APARTS_PROPERTY } from '@pms/imports';
import { PrismaService } from '../database/prisma.provider';
import { loadReservationCard, type ReservationCard } from './reservation-card';

/** Ячейка уже занята на эти ночи — сообщила база (exclusion constraint), не код. */
export class AllocationOverlapError extends Error {
  override readonly name = 'AllocationOverlapError';
  constructor(readonly unitId: string) {
    super(`Ячейка ${unitId} уже занята на эти ночи`);
  }
}

export interface CategoryRef {
  id: string;
  code: string;
  name: string;
  active: boolean;
  capacityAdults: number;
}
export interface RatePlanRef {
  id: string;
  code: string;
  name: string;
  currency: string;
  active: boolean;
}
export interface UnitRef {
  id: string;
  code: string;
  accommodationTypeId: string;
  active: boolean;
}
export interface AllocationState {
  id: string;
  unitId: string;
  unitCode: string;
  startDate: string;
  endDate: string;
}
export interface ItemState {
  id: string;
  accommodationTypeId: string;
  arrivalDate: string;
  departureDate: string;
  status: ReservationStatus;
  priceMinor: bigint;
  guestsCount: number;
  allocations: AllocationState[];
}
export interface ReservationState {
  id: string;
  confirmationNumber: string;
  externalId?: string | null;
  status: ReservationStatus;
  arrivalDate: string;
  departureDate: string;
  currency: string;
  items: ItemState[];
}
export interface NewGuest {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  phone?: string | null;
  email?: string | null;
}
export interface NewReservation {
  confirmationNumber: string;
  source: ReservationSource;
  /** Канал (OTA/сайт) текстом, например Booking.com; null для стойки */
  channel?: string | null;
  /** Номер брони на стороне канала (unique_id Channex) */
  externalId?: string | null;
  status: ReservationStatus;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children: number;
  currency: string;
  totalAmountMinor: bigint;
  primaryGuestId: string;
  notes: string | null;
  items: Array<{
    accommodationTypeId: string;
    arrivalDate: string;
    departureDate: string;
    priceMinor: bigint;
    status: ReservationStatus;
  }>;
}
export interface ChannelMappingRef {
  localAccommodationTypeId: string | null;
  localRatePlanId: string | null;
  providerPropertyId: string;
  providerRoomTypeId: string | null;
  providerRatePlanId: string | null;
}
export type ExternalEventStatus = 'RECEIVED' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
export interface NewExternalEvent {
  provider: string;
  externalEventId: string;
  type: string;
  payloadHash: string;
  payload: unknown;
}
export interface ExternalEventRef {
  id: string;
  status: ExternalEventStatus;
  attemptCount: number;
  isNew: boolean;
}
export interface AuditEntry {
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
}

/** Порт команд ручной брони. Все методы вызываются внутри одной транзакции (UnitOfWork). */
export interface ReservationsRepository {
  property(): Promise<{ id: string; currency: string }>;
  categoryByCode(code: string): Promise<CategoryRef | null>;
  ratePlanByCode(code: string): Promise<RatePlanRef | null>;
  /** Активные тарифы объекта — для формы брони */
  activeRatePlans(): Promise<RatePlanRef[]>;
  ratePlanCoversType(ratePlanId: string, accommodationTypeId: string): Promise<boolean>;
  nightRates(
    accommodationTypeId: string,
    ratePlanId: string,
    from: string,
    toExclusive: string,
  ): Promise<NightRate[]>;
  unitByCode(code: string): Promise<UnitRef | null>;
  hasBlockOverlap(unitId: string, from: string, toExclusive: string): Promise<boolean>;
  createGuest(guest: NewGuest): Promise<string>;
  createReservation(input: NewReservation): Promise<{ id: string; itemIds: string[] }>;
  addStayGuest(itemId: string, guestId: string, isPrimary: boolean): Promise<void>;
  createAllocation(
    itemId: string,
    unitId: string,
    startDate: string,
    endDate: string,
  ): Promise<void>;
  reservationByNumber(confirmationNumber: string): Promise<ReservationState | null>;
  updateItem(
    itemId: string,
    patch: Partial<{
      arrivalDate: string;
      departureDate: string;
      priceMinor: bigint;
      status: ReservationStatus;
    }>,
  ): Promise<void>;
  updateReservation(
    id: string,
    patch: Partial<{
      arrivalDate: string;
      departureDate: string;
      status: ReservationStatus;
      totalAmountMinor: bigint;
      externalId: string | null;
      channel: string | null;
      notes: string | null;
    }>,
  ): Promise<void>;
  deleteAllocation(id: string): Promise<void>;
  shortenAllocation(id: string, endDate: string): Promise<void>;
  replaceAllocationDates(id: string, startDate: string, endDate: string): Promise<void>;
  /** Бронь канала по внешнему ID (unique_id Channex) */
  reservationByExternalId(externalId: string): Promise<ReservationState | null>;
  /** Добавить проживание к существующей брони (модификация OTA-брони) */
  addReservationItem(reservationId: string, item: NewReservation['items'][number]): Promise<string>;
  /** Маппинг провайдера: категория/тариф ↔ ID провайдера */
  channelMappings(provider: string): Promise<ChannelMappingRef[]>;
  /** Журнал входящих событий (ADR-007): вернуть существующее или создать новое */
  recordExternalEvent(event: NewExternalEvent): Promise<ExternalEventRef>;
  updateExternalEvent(
    id: string,
    patch: { status: ExternalEventStatus; lastError?: string | null; processedAt?: Date | null },
  ): Promise<void>;
  audit(entry: AuditEntry): Promise<void>;
  card(confirmationNumber: string): Promise<ReservationCard | null>;
}

/** Одна команда = одна транзакция. В тестах подменяется фальшивкой. */
export interface UnitOfWork {
  run<T>(fn: (repo: ReservationsRepository) => Promise<T>): Promise<T>;
}
export const RESERVATIONS_UOW = Symbol('RESERVATIONS_UOW');

const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);
const json = (x: unknown) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

export class PrismaReservationsRepository implements ReservationsRepository {
  private propertyCache: { id: string; currency: string } | null = null;
  /** propertyName — имя объекта; в тестах на вымышленных данных передаётся тестовый объект. */
  constructor(
    private readonly db: Db | DbTx,
    private readonly propertyName: string = LUXX_APARTS_PROPERTY.name,
  ) {}

  async property(): Promise<{ id: string; currency: string }> {
    if (!this.propertyCache) {
      this.propertyCache = await this.db.property.findFirstOrThrow({
        where: { name: this.propertyName },
        select: { id: true, currency: true },
      });
    }
    return this.propertyCache;
  }
  async categoryByCode(code: string): Promise<CategoryRef | null> {
    const { id: propertyId } = await this.property();
    return this.db.accommodationType.findUnique({
      where: { propertyId_code: { propertyId, code } },
      select: { id: true, code: true, name: true, active: true, capacityAdults: true },
    });
  }
  async ratePlanByCode(code: string): Promise<RatePlanRef | null> {
    const { id: propertyId } = await this.property();
    return this.db.ratePlan.findUnique({
      where: { propertyId_code: { propertyId, code } },
      select: { id: true, code: true, name: true, currency: true, active: true },
    });
  }
  async activeRatePlans(): Promise<RatePlanRef[]> {
    const { id: propertyId } = await this.property();
    return this.db.ratePlan.findMany({
      where: { propertyId, active: true },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, currency: true, active: true },
    });
  }
  async ratePlanCoversType(ratePlanId: string, accommodationTypeId: string): Promise<boolean> {
    const link = await this.db.ratePlanAccommodationType.findUnique({
      where: { ratePlanId_accommodationTypeId: { ratePlanId, accommodationTypeId } },
      select: { ratePlanId: true },
    });
    return link !== null;
  }
  async nightRates(
    accommodationTypeId: string,
    ratePlanId: string,
    from: string,
    toExclusive: string,
  ): Promise<NightRate[]> {
    const rows = await this.db.dailyRate.findMany({
      where: {
        accommodationTypeId,
        ratePlanId,
        date: { gte: asDate(from), lt: asDate(toExclusive) },
      },
      select: { date: true, occupancy: true, price: true },
    });
    return rows.map((r) => ({ date: iso(r.date), occupancy: r.occupancy, priceMinor: r.price }));
  }
  async unitByCode(code: string): Promise<UnitRef | null> {
    return this.db.inventoryUnit.findUnique({
      where: { code },
      select: { id: true, code: true, accommodationTypeId: true, active: true },
    });
  }
  async hasBlockOverlap(unitId: string, from: string, toExclusive: string): Promise<boolean> {
    const n = await this.db.inventoryBlock.count({
      where: {
        inventoryUnitId: unitId,
        dateFrom: { lt: asDate(toExclusive) },
        dateTo: { gt: asDate(from) },
      },
    });
    return n > 0;
  }
  async createGuest(guest: NewGuest): Promise<string> {
    const g = await this.db.guest.create({
      data: {
        firstName: guest.firstName,
        lastName: guest.lastName,
        middleName: guest.middleName ?? null,
        phone: guest.phone ?? null,
        email: guest.email ?? null,
      },
      select: { id: true },
    });
    return g.id;
  }
  async createReservation(input: NewReservation): Promise<{ id: string; itemIds: string[] }> {
    const { id: propertyId } = await this.property();
    const r = await this.db.reservation.create({
      data: {
        propertyId,
        confirmationNumber: input.confirmationNumber,
        source: input.source,
        channel: input.channel ?? null,
        externalId: input.externalId ?? null,
        status: input.status,
        bookedAt: new Date(),
        arrivalDate: asDate(input.arrivalDate),
        departureDate: asDate(input.departureDate),
        adults: input.adults,
        children: input.children,
        currency: input.currency,
        totalAmount: input.totalAmountMinor,
        primaryGuestId: input.primaryGuestId,
        notes: input.notes,
      },
      select: { id: true },
    });
    const itemIds: string[] = [];
    for (const it of input.items) {
      const created = await this.db.reservationItem.create({
        data: {
          reservationId: r.id,
          accommodationTypeId: it.accommodationTypeId,
          arrivalDate: asDate(it.arrivalDate),
          departureDate: asDate(it.departureDate),
          price: it.priceMinor,
          status: it.status,
        },
        select: { id: true },
      });
      itemIds.push(created.id);
    }
    return { id: r.id, itemIds };
  }
  async addStayGuest(itemId: string, guestId: string, isPrimary: boolean): Promise<void> {
    await this.db.stayGuest.create({ data: { reservationItemId: itemId, guestId, isPrimary } });
  }
  async createAllocation(
    itemId: string,
    unitId: string,
    startDate: string,
    endDate: string,
  ): Promise<void> {
    try {
      await this.db.allocation.create({
        data: {
          reservationItemId: itemId,
          inventoryUnitId: unitId,
          startDate: asDate(startDate),
          endDate: asDate(endDate),
        },
      });
    } catch (e) {
      if (isOverlapViolation(e)) throw new AllocationOverlapError(unitId);
      throw e;
    }
  }
  async reservationByNumber(confirmationNumber: string): Promise<ReservationState | null> {
    const { id: propertyId } = await this.property();
    const r = await this.db.reservation.findUnique({
      where: { propertyId_confirmationNumber: { propertyId, confirmationNumber } },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            allocations: {
              orderBy: { startDate: 'asc' },
              include: { inventoryUnit: { select: { code: true } } },
            },
            _count: { select: { stayGuests: true } },
          },
        },
      },
    });
    if (!r) return null;
    return {
      id: r.id,
      confirmationNumber: r.confirmationNumber,
      externalId: r.externalId,
      status: r.status,
      arrivalDate: iso(r.arrivalDate),
      departureDate: iso(r.departureDate),
      currency: r.currency,
      items: r.items.map((it) => ({
        id: it.id,
        accommodationTypeId: it.accommodationTypeId,
        arrivalDate: iso(it.arrivalDate),
        departureDate: iso(it.departureDate),
        status: it.status,
        priceMinor: it.price,
        guestsCount: it._count.stayGuests,
        allocations: it.allocations.map((a) => ({
          id: a.id,
          unitId: a.inventoryUnitId,
          unitCode: a.inventoryUnit.code,
          startDate: iso(a.startDate),
          endDate: iso(a.endDate),
        })),
      })),
    };
  }
  async updateItem(
    itemId: string,
    patch: Partial<{
      arrivalDate: string;
      departureDate: string;
      priceMinor: bigint;
      status: ReservationStatus;
    }>,
  ): Promise<void> {
    await this.db.reservationItem.update({
      where: { id: itemId },
      data: {
        ...(patch.arrivalDate !== undefined ? { arrivalDate: asDate(patch.arrivalDate) } : {}),
        ...(patch.departureDate !== undefined
          ? { departureDate: asDate(patch.departureDate) }
          : {}),
        ...(patch.priceMinor !== undefined ? { price: patch.priceMinor } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
      },
    });
  }
  async updateReservation(
    id: string,
    patch: Partial<{
      arrivalDate: string;
      departureDate: string;
      status: ReservationStatus;
      totalAmountMinor: bigint;
      externalId: string | null;
      channel: string | null;
      notes: string | null;
    }>,
  ): Promise<void> {
    await this.db.reservation.update({
      where: { id },
      data: {
        ...(patch.arrivalDate !== undefined ? { arrivalDate: asDate(patch.arrivalDate) } : {}),
        ...(patch.departureDate !== undefined
          ? { departureDate: asDate(patch.departureDate) }
          : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.totalAmountMinor !== undefined ? { totalAmount: patch.totalAmountMinor } : {}),
        ...(patch.externalId !== undefined ? { externalId: patch.externalId } : {}),
        ...(patch.channel !== undefined ? { channel: patch.channel } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      },
    });
  }
  async deleteAllocation(id: string): Promise<void> {
    await this.db.allocation.delete({ where: { id } });
  }
  async shortenAllocation(id: string, endDate: string): Promise<void> {
    await this.db.allocation.update({ where: { id }, data: { endDate: asDate(endDate) } });
  }
  async replaceAllocationDates(id: string, startDate: string, endDate: string): Promise<void> {
    try {
      const a = await this.db.allocation.update({
        where: { id },
        data: { startDate: asDate(startDate), endDate: asDate(endDate) },
        select: { inventoryUnitId: true },
      });
      void a;
    } catch (e) {
      if (isOverlapViolation(e)) {
        const a = await this.db.allocation
          .findUnique({ where: { id }, select: { inventoryUnitId: true } })
          .catch(() => null);
        throw new AllocationOverlapError(a?.inventoryUnitId ?? id);
      }
      throw e;
    }
  }
  async reservationByExternalId(externalId: string): Promise<ReservationState | null> {
    const { id: propertyId } = await this.property();
    const r = await this.db.reservation.findFirst({
      where: { propertyId, externalId },
      orderBy: { createdAt: 'desc' },
      select: { confirmationNumber: true },
    });
    return r ? this.reservationByNumber(r.confirmationNumber) : null;
  }
  async addReservationItem(
    reservationId: string,
    it: NewReservation['items'][number],
  ): Promise<string> {
    const created = await this.db.reservationItem.create({
      data: {
        reservationId,
        accommodationTypeId: it.accommodationTypeId,
        arrivalDate: asDate(it.arrivalDate),
        departureDate: asDate(it.departureDate),
        price: it.priceMinor,
        status: it.status,
      },
      select: { id: true },
    });
    return created.id;
  }
  async channelMappings(provider: string): Promise<ChannelMappingRef[]> {
    const { id: propertyId } = await this.property();
    return this.db.channelMapping.findMany({
      where: { propertyId, provider },
      select: {
        localAccommodationTypeId: true,
        localRatePlanId: true,
        providerPropertyId: true,
        providerRoomTypeId: true,
        providerRatePlanId: true,
      },
    });
  }
  async recordExternalEvent(event: NewExternalEvent): Promise<ExternalEventRef> {
    const existing = await this.db.externalEvent.findUnique({
      where: {
        provider_externalEventId: {
          provider: event.provider,
          externalEventId: event.externalEventId,
        },
      },
      select: { id: true, status: true, attemptCount: true },
    });
    if (existing) return { ...existing, isNew: false };
    const created = await this.db.externalEvent.create({
      data: {
        provider: event.provider,
        externalEventId: event.externalEventId,
        type: event.type,
        payloadHash: event.payloadHash,
        payload: json(event.payload),
      },
      select: { id: true, status: true, attemptCount: true },
    });
    return { ...created, isNew: true };
  }
  async updateExternalEvent(
    id: string,
    patch: { status: ExternalEventStatus; lastError?: string | null; processedAt?: Date | null },
  ): Promise<void> {
    await this.db.externalEvent.update({
      where: { id },
      data: {
        status: patch.status,
        attemptCount: { increment: 1 },
        ...(patch.lastError !== undefined ? { lastError: patch.lastError } : {}),
        ...(patch.processedAt !== undefined ? { processedAt: patch.processedAt } : {}),
      },
    });
  }
  async audit(entry: AuditEntry): Promise<void> {
    await this.db.auditLog.create({
      data: {
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        before: json(entry.before),
        after: json(entry.after),
      },
    });
  }
  async card(confirmationNumber: string): Promise<ReservationCard | null> {
    const { id: propertyId } = await this.property();
    return loadReservationCard(this.db, propertyId, confirmationNumber);
  }
}

@Injectable()
export class PrismaUnitOfWork implements UnitOfWork {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  run<T>(fn: (repo: ReservationsRepository) => Promise<T>): Promise<T> {
    return this.prisma.db.$transaction((tx) => fn(new PrismaReservationsRepository(tx)), {
      timeout: 60_000,
      maxWait: 10_000,
    });
  }
}
