import 'reflect-metadata';
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { propertyIdRef, propertyToday } from '../database/property-ref';
import { auditUserId } from '../accounts/actor';
import { PrismaReservationsRepository } from '../reservations/reservations.repository';

export type BlockType = 'MAINTENANCE' | 'MANAGEMENT' | 'OUT_OF_ORDER' | 'OTHER';
export type HousekeepingStatus = 'DIRTY' | 'CLEAN' | 'INSPECTED';
export interface UnitCard {
  id: string;
  code: string;
  kind: 'ROOM' | 'BED';
  active: boolean;
  housekeepingStatus: HousekeepingStatus;
  accommodationTypeCode: string;
  accommodationTypeName: string;
  roomNumber: string;
  /** Расположение и вместимость для панели места (ADR-108, срез I2); вместимость — как в сводке фонда */
  buildingName: string;
  floorName: string;
  capacity: number;
  blocks: Array<{
    id: string;
    dateFrom: string;
    dateTo: string;
    type: BlockType;
    reason: string | null;
  }>;
  /** Ближайшие проживания в ячейке (для контекста и проверки пересечений) */
  stays: Array<{
    confirmationNumber: string;
    startDate: string;
    endDate: string;
    status: string;
    guestLabel: string;
  }>;
  housekeepingHistory: Array<{ at: string; from: HousekeepingStatus; to: HousekeepingStatus; by: string | null }>;
  /** «Кто убирает» (DATA_MODEL §4.1, миграция 143); null = не назначено */
  housekeepingAssignee: { id: string; name: string } | null;
  /** Когда место заведено и когда менялось в последний раз (в том числе сменой уборки), UTC ISO */
  createdAt: string;
  updatedAt: string;
}
export interface UnitsRepository {
  /** Сегодня по часам объекта (С-13, ТЗ аудита 25.09.2026) */
  today(): Promise<string>;
  unitByCode(code: string): Promise<{
    id: string;
    code: string;
    accommodationTypeId: string;
    accommodationTypeCode: string;
    housekeepingStatus: HousekeepingStatus;
    housekeepingAssigneeId?: string | null;
  } | null>;
  card(code: string, from: string, to: string): Promise<UnitCard | null>;
  /** Активный сотрудник того же бизнеса, что объект места (кандидат «Кто убирает») */
  housekeepingEmployee(unitId: string, employeeId: string): Promise<{ id: string; name: string } | null>;
  /** Назначение «Кто убирает» и его запись в журнале одной транзакцией */
  setHousekeepingAssignee(unitId: string, employeeId: string | null, before: string | null): Promise<void>;
  /** Проживания ячейки, пересекающие [from, toExclusive) — блокировать занятую ячейку нельзя */
  staysOverlapping(
    unitId: string,
    from: string,
    toExclusive: string,
  ): Promise<Array<{ confirmationNumber: string; startDate: string; endDate: string }>>;
  /** Блокировка и её запись в журнале — одной транзакцией (SECURITY.md §6); `after` дополняется её id */
  createBlock(
    unit: { id: string; accommodationTypeId: string },
    b: { dateFrom: string; dateTo: string; type: BlockType; reason: string | null },
    audit: { before: unknown; after: Record<string, unknown> },
  ): Promise<string>;
  blockById(
    id: string,
  ): Promise<{ id: string; unitId: string; dateFrom: string; dateTo: string } | null>;
  /** Снятие блокировки и запись в журнале — одной транзакцией */
  deleteBlock(id: string, audit: { unitId: string; before: unknown }): Promise<void>;
  setHousekeeping(unitId: string, from: HousekeepingStatus, to: HousekeepingStatus): Promise<void>;
  audit(entityId: string, action: string, before: unknown, after: unknown): Promise<void>;
}
export const UNITS_REPOSITORY = Symbol('UNITS_REPOSITORY');

const asDate = (d: string) => new Date(`${d}T00:00:00Z`);
/** Для колонок Json журнала: undefined — поля нет, null — как null */
const toJson = (x: unknown) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const iso = (x: Date) => x.toISOString().slice(0, 10);

@Injectable()
export class PrismaUnitsRepository implements UnitsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  /**
   * Ячейки объекта: вошедший — объект своей организации (ADR-061). Код ячейки уникален на всю базу, и поиск по нему
   * без объекта отдавал чужую ячейку с гостями и блокировками (аудит 26.09, В-1).
   */
  private async ofProperty() {
    return {
      accommodationType: {
        propertyId: await propertyIdRef(this.prisma.db, LUXX_APARTS_PROPERTY.name),
      },
    };
  }

  async today(): Promise<string> {
    return propertyToday(this.prisma.db, LUXX_APARTS_PROPERTY.name);
  }
  /**
   * Место своего объекта по коду: вошедший — объект своей организации, служебный ходок — Luxx. Код уникален только
   * внутри объекта (DATA_MODEL v1.12, ADR-099): поиск по одному коду нашёл бы место чужой гостиницы.
   */
  private async unitKey(code: string) {
    const propertyId = await propertyIdRef(this.prisma.db, LUXX_APARTS_PROPERTY.name);
    return { propertyId_code: { propertyId, code } };
  }
  async unitByCode(code: string) {
    const u = await this.prisma.db.inventoryUnit.findUnique({
      where: await this.unitKey(code),
      include: { accommodationType: { select: { code: true } } },
    });
    return u
      ? {
          id: u.id,
          code: u.code,
          accommodationTypeId: u.accommodationTypeId,
          accommodationTypeCode: u.accommodationType.code,
          housekeepingStatus: u.housekeepingStatus,
          housekeepingAssigneeId: u.housekeepingAssigneeId,
        }
      : null;
  }
  async card(code: string, from: string, to: string): Promise<UnitCard | null> {
    const u = await this.prisma.db.inventoryUnit.findUnique({
      where: await this.unitKey(code),
      include: {
        accommodationType: { select: { code: true, name: true } },
        physicalRoom: {
          select: {
            roomNumber: true,
            capacity: true,
            floor: { select: { name: true, building: { select: { name: true } } } },
          },
        },
        blocks: { where: { dateTo: { gt: asDate(from) } }, orderBy: { dateFrom: 'asc' } },
        allocations: {
          where: {
            endDate: { gt: asDate(from) },
            startDate: { lte: asDate(to) },
            reservationItem: { status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
          },
          orderBy: { startDate: 'asc' },
          include: {
            reservationItem: {
              include: {
                reservation: {
                  include: { primaryGuest: { select: { firstName: true, lastName: true } } },
                },
              },
            },
          },
        },
        housekeepingEvents: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { employee: { select: { name: true } }, user: { select: { name: true, email: true } } },
        },
        housekeepingAssignee: { select: { id: true, name: true } },
      },
    });
    if (!u) return null;
    return {
      id: u.id,
      code: u.code,
      kind: u.kind,
      active: u.active,
      housekeepingStatus: u.housekeepingStatus,
      accommodationTypeCode: u.accommodationType.code,
      accommodationTypeName: u.accommodationType.name,
      roomNumber: u.physicalRoom.roomNumber,
      buildingName: u.physicalRoom.floor.building.name,
      floorName: u.physicalRoom.floor.name,
      // как summarizeInventoryPlan: койка — одно место, номер — вместимость комнаты
      capacity: u.kind === 'BED' ? 1 : u.physicalRoom.capacity,
      blocks: u.blocks.map((b) => ({
        id: b.id,
        dateFrom: iso(b.dateFrom),
        dateTo: iso(b.dateTo),
        type: b.type,
        reason: b.reason,
      })),
      stays: u.allocations.map((a) => ({
        confirmationNumber: a.reservationItem.reservation.confirmationNumber,
        startDate: iso(a.startDate),
        endDate: iso(a.endDate),
        status: a.reservationItem.status,
        guestLabel: a.reservationItem.reservation.primaryGuest
          ? `${a.reservationItem.reservation.primaryGuest.firstName} ${a.reservationItem.reservation.primaryGuest.lastName}`.trim()
          : '',
      })),
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
      housekeepingHistory: u.housekeepingEvents.map((e) => ({
        at: e.createdAt.toISOString(),
        from: e.fromStatus,
        to: e.toStatus,
        by: e.employee?.name ?? e.user?.name ?? e.user?.email ?? null,
      })),
      housekeepingAssignee: u.housekeepingAssignee,
    };
  }
  async staysOverlapping(unitId: string, from: string, toExclusive: string) {
    const rows = await this.prisma.db.allocation.findMany({
      where: {
        inventoryUnitId: unitId,
        startDate: { lt: asDate(toExclusive) },
        endDate: { gt: asDate(from) },
        reservationItem: { status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
      },
      include: {
        reservationItem: { select: { reservation: { select: { confirmationNumber: true } } } },
      },
    });
    return rows.map((a) => ({
      confirmationNumber: a.reservationItem.reservation.confirmationNumber,
      startDate: iso(a.startDate),
      endDate: iso(a.endDate),
    }));
  }
  async createBlock(
    unit: { id: string; accommodationTypeId: string },
    b: { dateFrom: string; dateTo: string; type: BlockType; reason: string | null },
    audit: { before: unknown; after: Record<string, unknown> },
  ) {
    const unitId = unit.id;
    return this.prisma.db.$transaction(async (tx) => {
      /*
       * ТЗ аудита 25.09.2026, С-3: проверка «нет ли проживаний» до транзакции — гонка: гость успевал
       * заселиться между проверкой и вставкой, и ячейка закрывалась вместе с ним. Берём тот же
       * категорийный замок, что путь брони (lockCategories в reservations.repository), и перепроверяем
       * уже под ним: бронь либо завершилась до нас — и мы её видим, либо ждёт нас — и увидит блокировку
       * (hasBlockOverlap) под тем же замком.
       */
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`pms.category:${unit.accommodationTypeId}`}, 0))`;
      const busy = await tx.allocation.findMany({
        where: {
          inventoryUnitId: unitId,
          startDate: { lt: asDate(b.dateTo) },
          endDate: { gt: asDate(b.dateFrom) },
          reservationItem: { status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
        },
        include: {
          reservationItem: { select: { reservation: { select: { confirmationNumber: true } } } },
        },
      });
      if (busy.length)
        throw new ConflictException(
          `В ячейке есть проживание: ${busy
            .map(
              (a) =>
                `${a.reservationItem.reservation.confirmationNumber} (${iso(a.startDate)} → ${iso(a.endDate)})`,
            )
            .join(', ')} — сначала переселите`,
        );
      // Проверяем проданные проживания, включая ещё не назначенные на ячейку.
      // Уже закрытые ночи повторный блок не расходует: проверяем только новые интервалы.
      // Всё выполняется под тем же категорийным замком, что и создание брони.
      const target = await tx.inventoryUnit.findUniqueOrThrow({
        where: { id: unitId },
        select: { active: true },
      });
      if (target.active) {
        const existing = await tx.inventoryBlock.findMany({
          where: {
            inventoryUnitId: unitId,
            dateFrom: { lt: asDate(b.dateTo) },
            dateTo: { gt: asDate(b.dateFrom) },
          },
          orderBy: { dateFrom: 'asc' },
          select: { dateFrom: true, dateTo: true },
        });
        const gaps: Array<{ from: string; to: string }> = [];
        let cursor = b.dateFrom;
        for (const prior of existing) {
          const start = iso(prior.dateFrom);
          if (cursor < start) gaps.push({ from: cursor, to: start });
          if (cursor < iso(prior.dateTo)) cursor = iso(prior.dateTo);
          if (cursor >= b.dateTo) break;
        }
        if (cursor < b.dateTo) gaps.push({ from: cursor, to: b.dateTo });
        const availability = new PrismaReservationsRepository(tx);
        for (const gap of gaps) {
          if (
            (await availability.categoryAvailability(unit.accommodationTypeId, gap.from, gap.to)) <
            1
          )
            throw new ConflictException(
              'Нельзя заблокировать место: фонд категории уже продан на выбранные даты',
            );
        }
      }
      const row = await tx.inventoryBlock.create({
        data: {
          inventoryUnitId: unitId,
          dateFrom: asDate(b.dateFrom),
          dateTo: asDate(b.dateTo),
          type: b.type,
          reason: b.reason,
        },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: {
          userId: auditUserId(),
          entityType: 'InventoryUnit',
          entityId: unitId,
          action: 'unit.block',
          before: toJson(audit.before),
          after: toJson({ blockId: row.id, ...audit.after }),
        },
      });
      return row.id;
    });
  }
  async blockById(id: string) {
    const b = await this.prisma.db.inventoryBlock.findFirst({
      where: { id, inventoryUnit: await this.ofProperty() },
    });
    return b
      ? { id: b.id, unitId: b.inventoryUnitId, dateFrom: iso(b.dateFrom), dateTo: iso(b.dateTo) }
      : null;
  }
  async deleteBlock(id: string, audit: { unitId: string; before: unknown }) {
    await this.prisma.db.$transaction(async (tx) => {
      await tx.inventoryBlock.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          userId: auditUserId(),
          entityType: 'InventoryUnit',
          entityId: audit.unitId,
          action: 'unit.unblock',
          before: toJson(audit.before),
        },
      });
    });
  }
  /**
   * Статус и событие журнала одной транзакцией. Событие помнит, кто нажал, и чья это уборка: назначенный на место
   * сотрудник («Кто убирает», DATA_MODEL §4.1), чтобы уборка горничной без входа шла в её сдельную оплату.
   */
  async setHousekeeping(unitId: string, from: HousekeepingStatus, to: HousekeepingStatus) {
    await this.prisma.db.$transaction(async (tx) => {
      const changed = await tx.inventoryUnit.updateMany({
        where: { id: unitId, housekeepingStatus: from },
        data: { housekeepingStatus: to },
      });
      if (!changed.count) return;
      const unit = await tx.inventoryUnit.findUniqueOrThrow({ where: { id: unitId }, select: { housekeepingAssigneeId: true } });
      await tx.housekeepingEvent.create({
        data: {
          inventoryUnitId: unitId,
          fromStatus: from,
          toStatus: to,
          userId: auditUserId(),
          employeeId: from === 'DIRTY' && to === 'CLEAN' ? unit.housekeepingAssigneeId : null,
        },
      });
    });
  }
  async housekeepingEmployee(unitId: string, employeeId: string) {
    const unit = await this.prisma.db.inventoryUnit.findUnique({
      where: { id: unitId },
      select: { property: { select: { location: { select: { businessId: true } } } } },
    });
    const businessId = unit?.property.location?.businessId;
    if (!businessId) return null;
    return this.prisma.db.employee.findFirst({
      where: { id: employeeId, businessId, status: 'ACTIVE' },
      select: { id: true, name: true },
    });
  }
  async setHousekeepingAssignee(unitId: string, employeeId: string | null, before: string | null) {
    await this.prisma.db.$transaction([
      this.prisma.db.inventoryUnit.update({ where: { id: unitId }, data: { housekeepingAssigneeId: employeeId } }),
      this.prisma.db.auditLog.create({
        data: {
          userId: auditUserId(),
          entityType: 'InventoryUnit',
          entityId: unitId,
          action: 'unit.housekeeping_assignee',
          before: toJson({ employeeId: before }),
          after: toJson({ employeeId }),
        },
      }),
    ]);
  }
  async audit(entityId: string, action: string, before: unknown, after: unknown) {
    await this.prisma.db.auditLog.create({
      data: {
        userId: auditUserId(),
        entityType: 'InventoryUnit',
        entityId,
        action,
        before: toJson(before),
        after: toJson(after),
      },
    });
  }
}
