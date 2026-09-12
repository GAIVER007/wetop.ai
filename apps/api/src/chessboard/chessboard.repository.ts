import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import type {
  ChessboardAllocation,
  ChessboardBlock,
  ChessboardUnit,
  UnassignedStay,
} from '@pms/domain';
import { LUXX_APARTS_PROPERTY } from '@pms/imports';
import { PrismaService } from '../database/prisma.provider';
import { loadReservationCard, type ReservationCard } from '../reservations/reservation-card';

export type { ReservationCard, ReservationCardItem } from '../reservations/reservation-card';

/** Порт чтения шахматки. В тестах подменяется фальшивкой. */
/** Проданное проживание категории, с ячейкой или без — так считает остаток канал (Q-107) */
export interface SoldStay {
  accommodationTypeCode: string;
  arrivalDate: string;
  departureDate: string;
}
export interface ChessboardRepository {
  units(): Promise<ChessboardUnit[]>;
  allocations(from: string, to: string): Promise<ChessboardAllocation[]>;
  blocks(from: string, to: string): Promise<ChessboardBlock[]>;
  /** Активные проживания, задевающие ночи [from, toExclusive) — включая брони без ячейки */
  soldStays(from: string, toExclusive: string): Promise<SoldStay[]>;
  /** Активные проживания БЕЗ единого назначения, задевающие ночи [from, toExclusive) — строка «Без ячейки» */
  unassignedStays(from: string, toExclusive: string): Promise<UnassignedStay[]>;
  reservation(confirmationNumber: string): Promise<ReservationCard | null>;
}
export const CHESSBOARD_REPOSITORY = Symbol('CHESSBOARD_REPOSITORY');

const d = (x: Date) => x.toISOString().slice(0, 10);
const guestLabel = (g: { firstName: string; lastName: string } | null | undefined) =>
  g ? `${g.firstName} ${g.lastName}`.trim() : '';

@Injectable()
export class PrismaChessboardRepository implements ChessboardRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async propertyId(): Promise<string> {
    const p = await this.prisma.db.property.findFirstOrThrow({
      where: { name: LUXX_APARTS_PROPERTY.name },
      select: { id: true },
    });
    return p.id;
  }

  async units(): Promise<ChessboardUnit[]> {
    const propertyId = await this.propertyId();
    const rows = await this.prisma.db.inventoryUnit.findMany({
      where: { accommodationType: { propertyId }, active: true },
      include: { accommodationType: { select: { code: true, name: true } } },
    });
    return rows
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
      .map((u) => ({
        id: u.id,
        code: u.code,
        kind: u.kind,
        accommodationTypeCode: u.accommodationType.code,
        accommodationTypeName: u.accommodationType.name,
      }));
  }

  /** Назначения, пересекающие [from, to]: start < to+1 и end > from. */
  async soldStays(from: string, toExclusive: string): Promise<SoldStay[]> {
    const rows = await this.prisma.db.reservationItem.findMany({
      where: {
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        arrivalDate: { lt: new Date(`${toExclusive}T00:00:00Z`) },
        departureDate: { gt: new Date(`${from}T00:00:00Z`) },
        reservation: { property: { name: LUXX_APARTS_PROPERTY.name } },
      },
      select: {
        arrivalDate: true,
        departureDate: true,
        accommodationType: { select: { code: true } },
      },
    });
    return rows.map((r) => ({
      accommodationTypeCode: r.accommodationType.code,
      arrivalDate: d(r.arrivalDate),
      departureDate: d(r.departureDate),
    }));
  }
  /**
   * Проживания без ячейки: живой статус (не отменено, не незаезд, не выселено — выселенному ячейка
   * больше не нужна), ни одного назначения, ночи пересекают [from, toExclusive). Фильтр `allocations: { none: {} }` — «нет ни одной связанной записи»;
   * `some: {}` в Prisma пустой фильтр не применяет, поэтому здесь не годится.
   */
  async unassignedStays(from: string, toExclusive: string): Promise<UnassignedStay[]> {
    const rows = await this.prisma.db.reservationItem.findMany({
      where: {
        status: { notIn: ['CANCELLED', 'NO_SHOW', 'CHECKED_OUT'] },
        arrivalDate: { lt: new Date(`${toExclusive}T00:00:00Z`) },
        departureDate: { gt: new Date(`${from}T00:00:00Z`) },
        reservation: { property: { name: LUXX_APARTS_PROPERTY.name } },
        allocations: { none: {} },
      },
      select: {
        arrivalDate: true,
        departureDate: true,
        status: true,
        reservation: { select: { confirmationNumber: true } },
        accommodationType: { select: { code: true, name: true } },
      },
    });
    return rows.map((r) => ({
      confirmationNumber: r.reservation.confirmationNumber,
      categoryCode: r.accommodationType.code,
      categoryName: r.accommodationType.name,
      arrivalDate: d(r.arrivalDate),
      departureDate: d(r.departureDate),
      status: r.status,
    }));
  }

  async allocations(from: string, to: string): Promise<ChessboardAllocation[]> {
    const rows = await this.prisma.db.allocation.findMany({
      where: {
        startDate: { lte: new Date(`${to}T00:00:00Z`) },
        endDate: { gt: new Date(`${from}T00:00:00Z`) },
        reservationItem: { status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
      },
      include: {
        reservationItem: {
          include: {
            reservation: {
              include: {
                primaryGuest: { select: { firstName: true, lastName: true, phone: true } },
              },
            },
          },
        },
      },
    });
    return rows.map((a) => ({
      unitId: a.inventoryUnitId,
      startDate: d(a.startDate),
      endDate: d(a.endDate),
      itemId: a.reservationItemId,
      itemStatus: a.reservationItem.status,
      confirmationNumber: a.reservationItem.reservation.confirmationNumber,
      guestLabel: guestLabel(a.reservationItem.reservation.primaryGuest),
      guestPhone: a.reservationItem.reservation.primaryGuest?.phone ?? null,
    }));
  }

  async blocks(from: string, to: string): Promise<ChessboardBlock[]> {
    const rows = await this.prisma.db.inventoryBlock.findMany({
      where: {
        dateFrom: { lte: new Date(`${to}T00:00:00Z`) },
        dateTo: { gt: new Date(`${from}T00:00:00Z`) },
      },
    });
    return rows.map((b) => ({
      unitId: b.inventoryUnitId,
      dateFrom: d(b.dateFrom),
      dateTo: d(b.dateTo),
      type: b.type,
      reason: b.reason,
    }));
  }

  async reservation(confirmationNumber: string): Promise<ReservationCard | null> {
    return loadReservationCard(this.prisma.db, await this.propertyId(), confirmationNumber);
  }
}
