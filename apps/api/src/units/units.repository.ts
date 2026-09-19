import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { auditUserId } from '../accounts/actor';

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
  housekeepingHistory: Array<{ at: string; from: HousekeepingStatus; to: HousekeepingStatus }>;
}
export interface UnitsRepository {
  unitByCode(code: string): Promise<{
    id: string;
    code: string;
    accommodationTypeCode: string;
    housekeepingStatus: HousekeepingStatus;
  } | null>;
  card(code: string, from: string, to: string): Promise<UnitCard | null>;
  /** Проживания ячейки, пересекающие [from, toExclusive) — блокировать занятую ячейку нельзя */
  staysOverlapping(
    unitId: string,
    from: string,
    toExclusive: string,
  ): Promise<Array<{ confirmationNumber: string; startDate: string; endDate: string }>>;
  createBlock(
    unitId: string,
    b: { dateFrom: string; dateTo: string; type: BlockType; reason: string | null },
  ): Promise<string>;
  blockById(
    id: string,
  ): Promise<{ id: string; unitId: string; dateFrom: string; dateTo: string } | null>;
  deleteBlock(id: string): Promise<void>;
  setHousekeeping(unitId: string, from: HousekeepingStatus, to: HousekeepingStatus): Promise<void>;
  audit(entityId: string, action: string, before: unknown, after: unknown): Promise<void>;
}
export const UNITS_REPOSITORY = Symbol('UNITS_REPOSITORY');

const asDate = (d: string) => new Date(`${d}T00:00:00Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);

@Injectable()
export class PrismaUnitsRepository implements UnitsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async unitByCode(code: string) {
    const u = await this.prisma.db.inventoryUnit.findUnique({
      where: { code },
      include: { accommodationType: { select: { code: true } } },
    });
    return u
      ? {
          id: u.id,
          code: u.code,
          accommodationTypeCode: u.accommodationType.code,
          housekeepingStatus: u.housekeepingStatus,
        }
      : null;
  }
  async card(code: string, from: string, to: string): Promise<UnitCard | null> {
    const u = await this.prisma.db.inventoryUnit.findUnique({
      where: { code },
      include: {
        accommodationType: { select: { code: true, name: true } },
        physicalRoom: { select: { roomNumber: true } },
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
        housekeepingEvents: { orderBy: { createdAt: 'desc' }, take: 10 },
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
      housekeepingHistory: u.housekeepingEvents.map((e) => ({
        at: e.createdAt.toISOString(),
        from: e.fromStatus,
        to: e.toStatus,
      })),
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
    unitId: string,
    b: { dateFrom: string; dateTo: string; type: BlockType; reason: string | null },
  ) {
    const row = await this.prisma.db.inventoryBlock.create({
      data: {
        inventoryUnitId: unitId,
        dateFrom: asDate(b.dateFrom),
        dateTo: asDate(b.dateTo),
        type: b.type,
        reason: b.reason,
      },
      select: { id: true },
    });
    return row.id;
  }
  async blockById(id: string) {
    const b = await this.prisma.db.inventoryBlock.findUnique({ where: { id } });
    return b
      ? { id: b.id, unitId: b.inventoryUnitId, dateFrom: iso(b.dateFrom), dateTo: iso(b.dateTo) }
      : null;
  }
  async deleteBlock(id: string) {
    await this.prisma.db.inventoryBlock.delete({ where: { id } });
  }
  async setHousekeeping(unitId: string, from: HousekeepingStatus, to: HousekeepingStatus) {
    await this.prisma.db.$transaction([
      this.prisma.db.inventoryUnit.update({
        where: { id: unitId },
        data: { housekeepingStatus: to },
      }),
      this.prisma.db.housekeepingEvent.create({
        data: { inventoryUnitId: unitId, fromStatus: from, toStatus: to },
      }),
    ]);
  }
  async audit(entityId: string, action: string, before: unknown, after: unknown) {
    const j = (x: unknown) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
    await this.prisma.db.auditLog.create({
      data: {
        userId: auditUserId(),
        entityType: 'InventoryUnit',
        entityId,
        action,
        before: j(before),
        after: j(after),
      },
    });
  }
}
