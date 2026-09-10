import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import { folioBalance } from '@pms/domain';
import { LUXX_APARTS_PROPERTY } from '@pms/imports';
import { PrismaService } from '../database/prisma.provider';

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
}
/** Рабочий день стойки: кто заезжает, кто выезжает, кто живёт (SPEC §6). */
export interface DeskRepository {
  stays(date: string): Promise<DeskStay[]>;
}
export const DESK_REPOSITORY = Symbol('DESK_REPOSITORY');

const asDate = (d: string) => new Date(`${d}T00:00:00Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);

@Injectable()
export class PrismaDeskRepository implements DeskRepository {
  private readonly propertyName = LUXX_APARTS_PROPERTY.name;
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Все проживания, которые касаются суток: заезд в этот день, выезд в этот день или гость живёт.
   * Отменённые и незаезды не показываем — стойке они в работе дня не нужны.
   */
  async stays(date: string): Promise<DeskStay[]> {
    const property = await this.prisma.db.property.findFirstOrThrow({
      where: { name: this.propertyName },
      select: { id: true },
    });
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
        accommodationType: { select: { name: true } },
        allocations: {
          orderBy: { startDate: 'asc' },
          select: { inventoryUnit: { select: { code: true } } },
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
        unitCode: r.allocations.at(-1)?.inventoryUnit.code ?? null,
        accommodationTypeName: r.accommodationType.name,
        arrivalDate: iso(r.arrivalDate),
        departureDate: iso(r.departureDate),
        status: r.status,
        balanceMinor: balance,
        citizenship: g?.citizenship ?? null,
      };
    });
  }
}
