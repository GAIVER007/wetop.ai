import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import type {
  ChessboardAllocation,
  ChessboardBlock,
  ChessboardUnit,
  UnassignedStay,
} from '@pms/domain';
import { folioBalance, LUXX_APARTS_PROPERTY, soldDeparture } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { loadReservationCard, type ReservationCard } from '../reservations/reservation-card';
import { propertyToday, propertyIdRef } from '../database/property-ref';

export type { ReservationCard, ReservationCardItem } from '../reservations/reservation-card';

/** Порт чтения шахматки. В тестах подменяется фальшивкой. */
/** Проданное проживание категории, с ячейкой или без — так считает остаток канал (Q-107) */
export interface SoldStay {
  accommodationTypeCode: string;
  arrivalDate: string;
  departureDate: string;
}
export interface ChessboardRepository {
  /** Сегодня по часам объекта (С-13, ТЗ аудита 25.09.2026) */
  today(): Promise<string>;
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

  /** id объекта — из памяти процесса: рейс в базу за ним на каждый запрос стоил дороже самих данных */
  private propertyId(): Promise<string> {
    return propertyIdRef(this.prisma.db, LUXX_APARTS_PROPERTY.name);
  }

  async today(): Promise<string> {
    return propertyToday(this.prisma.db, LUXX_APARTS_PROPERTY.name);
  }

  async units(): Promise<ChessboardUnit[]> {
    const propertyId = await this.propertyId();
    const rows = await this.prisma.db.inventoryUnit.findMany({
      where: { accommodationType: { propertyId }, active: true },
      include: {
        accommodationType: { select: { code: true, name: true } },
        physicalRoom: { select: { roomNumber: true } },
      },
    });
    return rows
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
      .map((u) => ({
        id: u.id,
        code: u.code,
        kind: u.kind,
        accommodationTypeCode: u.accommodationType.code,
        accommodationTypeName: u.accommodationType.name,
        // Срез 7.1: убрана ли ячейка — значок в строке, по правилу объекта у номера
        housekeepingStatus: u.housekeepingStatus,
        // ТЗ v2 §17 (подготовка к Q-095): пока комнаты 1:1, UI по ним не группирует
        physicalRoomNumber: u.physicalRoom.roomNumber,
      }));
  }

  /** Назначения, пересекающие [from, to]: start < to+1 и end > from. */
  async soldStays(from: string, toExclusive: string): Promise<SoldStay[]> {
    const propertyId = await this.propertyId();
    const rows = await this.prisma.db.reservationItem.findMany({
      where: {
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        arrivalDate: { lt: new Date(`${toExclusive}T00:00:00Z`) },
        departureDate: { gt: new Date(`${from}T00:00:00Z`) },
        // По объекту своей организации (мультитенантность): id из property-ref, не имя
        reservation: { propertyId },
      },
      select: {
        status: true,
        allocations: { select: { endDate: true } },
        arrivalDate: true,
        departureDate: true,
        accommodationType: { select: { code: true } },
      },
    });
    return rows.flatMap((r) => {
      const departureDate = soldDeparture({
        status: r.status,
        departureDate: d(r.departureDate),
        allocationEndDates: r.allocations.map((a) => d(a.endDate)),
      });
      if (!departureDate || departureDate <= from) return [];
      return [
        {
          accommodationTypeCode: r.accommodationType.code,
          arrivalDate: d(r.arrivalDate),
          departureDate,
        },
      ];
    });
  }
  /**
   * Проживания без ячейки: живой статус (не отменено, не незаезд, не выселено — выселенному ячейка
   * больше не нужна), ни одного назначения, ночи пересекают [from, toExclusive). Фильтр `allocations: { none: {} }` — «нет ни одной связанной записи»;
   * `some: {}` в Prisma пустой фильтр не применяет, поэтому здесь не годится.
   */
  async unassignedStays(from: string, toExclusive: string): Promise<UnassignedStay[]> {
    const propertyId = await this.propertyId();
    const rows = await this.prisma.db.reservationItem.findMany({
      where: {
        status: { notIn: ['CANCELLED', 'NO_SHOW', 'CHECKED_OUT'] },
        arrivalDate: { lt: new Date(`${toExclusive}T00:00:00Z`) },
        departureDate: { gt: new Date(`${from}T00:00:00Z`) },
        reservation: { propertyId },
        allocations: { none: {} },
      },
      select: {
        id: true,
        arrivalDate: true,
        departureDate: true,
        status: true,
        reservation: {
          select: {
            confirmationNumber: true,
            primaryGuest: { select: { firstName: true, lastName: true } },
          },
        },
        accommodationType: { select: { code: true, name: true } },
      },
    });
    return rows.map((r) => ({
      confirmationNumber: r.reservation.confirmationNumber,
      itemId: r.id,
      guestLabel: guestLabel(r.reservation.primaryGuest),
      categoryCode: r.accommodationType.code,
      categoryName: r.accommodationType.name,
      arrivalDate: d(r.arrivalDate),
      departureDate: d(r.departureDate),
      status: r.status,
    }));
  }

  async allocations(from: string, to: string): Promise<ChessboardAllocation[]> {
    const propertyId = await this.propertyId();
    const rows = await this.prisma.db.allocation.findMany({
      where: {
        startDate: { lte: new Date(`${to}T00:00:00Z`) },
        endDate: { gt: new Date(`${from}T00:00:00Z`) },
        // Прежде фильтра по объекту тут не было (один объект в MVP) — на мультитенанте это отдавало
        // бы назначения всех отелей. Теперь только свой объект (разбор изоляции 21.09).
        reservationItem: {
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
          reservation: { propertyId },
        },
      },
      include: {
        reservationItem: {
          include: {
            reservation: {
              include: {
                primaryGuest: { select: { firstName: true, lastName: true, phone: true } },
              },
            },
            // Срез 7.1: остаток к оплате — тем же расчётом, что в списке броней и на карточке
            folio: {
              select: {
                charges: { where: { voidedAt: null }, select: { amount: true } },
                allocations: {
                  where: { payment: { status: 'COMPLETED' } },
                  select: { amount: true },
                },
                refunds: { select: { amount: true } },
              },
            },
          },
        },
      },
    });
    return rows.map((a) => {
      const folio = a.reservationItem.folio;
      // остаток = начислено − оплачено + возвращено; `folioBalance` отдаёт разбор, нужен один итог
      const balance = folio
        ? folioBalance({
            charges: folio.charges.map((c) => ({ amountMinor: c.amount, voided: false })),
            allocations: folio.allocations.map((x) => ({ amountMinor: x.amount })),
            refunds: folio.refunds.map((x) => ({ amountMinor: x.amount })),
          }).balanceMinor
        : 0n;
      return {
        unitId: a.inventoryUnitId,
        startDate: d(a.startDate),
        endDate: d(a.endDate),
        itemId: a.reservationItemId,
        itemStatus: a.reservationItem.status,
        confirmationNumber: a.reservationItem.reservation.confirmationNumber,
        guestLabel: guestLabel(a.reservationItem.reservation.primaryGuest),
        guestPhone: a.reservationItem.reservation.primaryGuest?.phone ?? null,
        source: a.reservationItem.reservation.source,
        channel: a.reservationItem.reservation.channel,
        balanceMinor: balance.toString(),
      };
    });
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
