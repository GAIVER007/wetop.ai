import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import { folioBalance } from '@pms/domain';
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { propertyToday, propertyIdRef } from '../database/property-ref';

export interface DeskStay {
  itemId: string;
  confirmationNumber: string;
  guestLabel: string;
  guestPhone: string | null;
  unitCode: string | null;
  accommodationTypeName: string;
  arrivalDate: string;
  departureDate: string;
  status: string;
  /** integer minor units; > 0 — гость должен */
  balanceMinor: bigint;
  citizenship: string | null;
  /** Сколько гостей заявлено в брони и на скольких заведены карточки (Q-098: за август 1103 против 1048) */
  adults: number;
  guestsRecorded: number;
}
/** Рабочий день стойки: кто заезжает, кто выезжает, кто живёт (SPEC §6). */
export interface DeskRepository {
  /** Сегодня по часам объекта (С-13, ТЗ аудита 25.09.2026) */
  today(): Promise<string>;
  stays(date: string): Promise<DeskStay[]>;
  /** Открытые задачи стойки со сроком не позже даты (DATA_MODEL §22): число для панели «Сегодня» */
  openTasksDue(date: string): Promise<number>;
}
export const DESK_REPOSITORY = Symbol('DESK_REPOSITORY');

const asDate = (d: string) => new Date(`${d}T00:00:00Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);

@Injectable()
export class PrismaDeskRepository implements DeskRepository {
  private readonly propertyName = LUXX_APARTS_PROPERTY.name;

  async today(): Promise<string> {
    return propertyToday(this.prisma.db, this.propertyName);
  }
  async openTasksDue(date: string): Promise<number> {
    return this.prisma.db.deskTask.count({
      where: {
        propertyId: await propertyIdRef(this.prisma.db, this.propertyName),
        doneAt: null,
        dueDate: { lte: asDate(date) },
      },
    });
  }
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Все проживания, которые касаются суток: заезд в этот день, выезд в этот день или гость живёт.
   * Отменённые и незаезды не показываем — стойке они в работе дня не нужны.
   */
  async stays(date: string): Promise<DeskStay[]> {
    const property = { id: await propertyIdRef(this.prisma.db, this.propertyName) };
    const d = asDate(date);
    const rows = await this.prisma.db.reservationItem.findMany({
      where: {
        reservation: { propertyId: property.id },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        arrivalDate: { lte: d },
        departureDate: { gte: d },
      },
      select: {
        id: true,
        arrivalDate: true,
        departureDate: true,
        status: true,
        adults: true,
        _count: { select: { stayGuests: true } },
        accommodationType: { select: { name: true } },
        allocations: {
          orderBy: { startDate: 'asc' },
          select: {
            startDate: true,
            endDate: true,
            inventoryUnit: { select: { code: true } },
          },
        },
        reservation: {
          select: {
            confirmationNumber: true,
            primaryGuest: {
              select: { firstName: true, lastName: true, phone: true, citizenship: true },
            },
          },
        },
        folio: {
          select: {
            charges: { select: { amount: true, voidedAt: true } },
            allocations: { select: { amount: true, payment: { select: { status: true } } } },
            refunds: { select: { amount: true } },
          },
        },
      },
      orderBy: [{ arrivalDate: 'asc' }],
    });
    return rows.map((r) => {
      const g = r.reservation.primaryGuest;
      const f = r.folio;
      const balance = f
        ? folioBalance({
            charges: f.charges.map((c) => ({ amountMinor: c.amount, voided: c.voidedAt !== null })),
            allocations: f.allocations
              .filter((a) => a.payment.status === 'COMPLETED')
              .map((a) => ({ amountMinor: a.amount })),
            refunds: f.refunds.map((x) => ({ amountMinor: x.amount })),
          }).balanceMinor
        : 0n;
      return {
        itemId: r.id,
        confirmationNumber: r.reservation.confirmationNumber,
        guestLabel: g ? `${g.firstName} ${g.lastName}`.trim() : '',
        guestPhone: g?.phone ?? null,
        // Ячейка на ЗАПРОШЕННУЮ ночь: после переселения у проживания их несколько, и последняя —
        // не та, где гость сегодня. Для выезжающих ночи уже нет, поэтому берём последнюю.
        unitCode:
          (r.allocations.find((x) => x.startDate <= d && d < x.endDate) ?? r.allocations.at(-1))
            ?.inventoryUnit.code ?? null,
        accommodationTypeName: r.accommodationType.name,
        arrivalDate: iso(r.arrivalDate),
        departureDate: iso(r.departureDate),
        status: r.status,
        balanceMinor: balance,
        citizenship: g?.citizenship ?? null,
        adults: r.adults,
        guestsRecorded: r._count.stayGuests,
      };
    });
  }
}
