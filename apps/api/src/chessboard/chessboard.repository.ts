import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import type { ChessboardAllocation, ChessboardBlock, ChessboardUnit } from '@pms/domain';
import { LUXX_APARTS_PROPERTY } from '@pms/imports';
import { PrismaService } from '../database/prisma.provider';
import { loadReservationCard, type ReservationCard } from '../reservations/reservation-card';

export type { ReservationCard, ReservationCardItem } from '../reservations/reservation-card';

/** Порт чтения шахматки. В тестах подменяется фальшивкой. */
export interface ChessboardRepository {
  units(): Promise<ChessboardUnit[]>;
  allocations(from: string, to: string): Promise<ChessboardAllocation[]>;
  blocks(from: string, to: string): Promise<ChessboardBlock[]>;
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
              include: { primaryGuest: { select: { firstName: true, lastName: true } } },
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
