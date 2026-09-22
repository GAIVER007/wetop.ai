import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import type { DashboardCharge, DashboardDay, DashboardPayment, DashboardStay } from '@pms/domain';
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
import { channex } from '@pms/integrations';
import { PrismaService } from '../database/prisma.provider';
import { ChessboardService } from '../chessboard/chessboard.service';
import { propertyIdRef } from '../database/property-ref';

export interface DashboardBoard {
  categories: Array<{ code: string; name: string; units: number }>;
  days: DashboardDay[];
  unassigned: number;
}
/** Что нужно дашборду за период: шахматка, проживания, начисления, платежи, возвраты. */
export interface DashboardRepository {
  board(from: string, to: string): Promise<DashboardBoard>;
  /** Проживания, у которых заезд или выезд попадает в [from, to] */
  stays(from: string, to: string): Promise<DashboardStay[]>;
  /** Начисления без сторно с service_date в [from, to] — как «Деньги за период» */
  charges(from: string, to: string): Promise<DashboardCharge[]>;
  /** Платежи COMPLETED, проведённые в сутках объекта [from, to] */
  payments(from: string, to: string): Promise<DashboardPayment[]>;
  refundsMinor(from: string, to: string): Promise<bigint>;
}
export const DASHBOARD_REPOSITORY = Symbol('DASHBOARD_REPOSITORY');

const BOARD_CHUNK_DAYS = 62;
const asDate = (d: string) => new Date(`${d}T00:00:00Z`);
const plusDays = (iso: string, n: number) => {
  const x = asDate(iso);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
/** Границы суток объекта (Asia/Almaty, UTC+5) для событий со временем — как в финансовом отчёте */
const ALMATY_OFFSET = '+05:00';
const localStart = (d: string) => new Date(`${d}T00:00:00${ALMATY_OFFSET}`);
const localEndExclusive = (d: string) => {
  const x = new Date(`${d}T00:00:00${ALMATY_OFFSET}`);
  x.setUTCDate(x.getUTCDate() + 1);
  return x;
};

@Injectable()
export class PrismaDashboardRepository implements DashboardRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ChessboardService) private readonly chessboard: ChessboardService,
  ) {}

  /** id объекта — из памяти процесса: дашборд спрашивал его восемь раз за один запрос */
  private propertyId(): Promise<string> {
    return propertyIdRef(this.prisma.db, LUXX_APARTS_PROPERTY.name);
  }

  /** Та же шахматка, что на экране, кусками по 62 дня (её потолок за запрос) */
  async board(from: string, to: string): Promise<DashboardBoard> {
    const days: DashboardDay[] = [];
    const categories = new Map<string, { code: string; name: string; units: number }>();
    const unassigned = new Set<string>();
    for (let start = from; start <= to; start = plusDays(start, BOARD_CHUNK_DAYS)) {
      const end = [plusDays(start, BOARD_CHUNK_DAYS - 1), to].sort()[0]!;
      const b = await this.chessboard.board(start, end);
      if (!categories.size)
        for (const r of b.rows) {
          const code = r.unit.accommodationTypeCode;
          const c = categories.get(code) ?? { code, name: r.unit.accommodationTypeName, units: 0 };
          categories.set(code, { ...c, units: c.units + 1 });
        }
      for (const date of b.dates)
        days.push({
          date,
          ...(b.summary[date] ?? { occupied: 0, free: 0, blocked: 0 }),
          byCategory: b.byCategory[date] ?? {},
        });
      for (const u of b.unassigned)
        unassigned.add(`${u.confirmationNumber}|${u.categoryCode}|${u.arrivalDate}`);
    }
    return { categories: [...categories.values()], days, unassigned: unassigned.size };
  }

  async stays(from: string, to: string): Promise<DashboardStay[]> {
    const propertyId = await this.propertyId();
    const range = { gte: asDate(from), lte: asDate(to) };
    const rows = await this.prisma.db.reservationItem.findMany({
      where: {
        reservation: { propertyId },
        OR: [{ arrivalDate: range }, { departureDate: range }],
      },
      select: {
        arrivalDate: true,
        departureDate: true,
        status: true,
        adults: true,
        children: true,
        price: true,
        accommodationType: { select: { code: true } },
        reservation: { select: { source: true, channel: true } },
      },
    });
    return rows.map((r) => ({
      arrivalDate: r.arrivalDate.toISOString().slice(0, 10),
      departureDate: r.departureDate.toISOString().slice(0, 10),
      status: r.status,
      adults: r.adults,
      children: r.children,
      priceMinor: r.price,
      source: r.reservation.source,
      // Один канал Channex присылает под разными именами — на «Главной» он один (plans/channel-name-canonical-2026-09-22.md)
      channel: r.reservation.channel === null ? null : channex.otaChannelLabel(r.reservation.channel),
      categoryCode: r.accommodationType.code,
    }));
  }

  async charges(from: string, to: string): Promise<DashboardCharge[]> {
    const propertyId = await this.propertyId();
    const rows = await this.prisma.db.charge.findMany({
      where: {
        voidedAt: null,
        serviceDate: { gte: asDate(from), lte: asDate(to) },
        folio: { reservationItem: { reservation: { propertyId } } },
      },
      select: {
        kind: true,
        amount: true,
        folio: {
          select: {
            reservationItem: { select: { accommodationType: { select: { code: true } } } },
          },
        },
      },
    });
    return rows.map((c) => ({
      kind: c.kind,
      amountMinor: c.amount,
      categoryCode: c.folio.reservationItem.accommodationType.code,
    }));
  }

  async payments(from: string, to: string): Promise<DashboardPayment[]> {
    const propertyId = await this.propertyId();
    const rows = await this.prisma.db.payment.findMany({
      where: {
        propertyId,
        status: 'COMPLETED',
        paidAt: { gte: localStart(from), lt: localEndExclusive(to) },
      },
      select: { method: true, amount: true },
    });
    return rows.map((p) => ({ method: p.method, amountMinor: p.amount }));
  }

  async refundsMinor(from: string, to: string): Promise<bigint> {
    const propertyId = await this.propertyId();
    const rows = await this.prisma.db.refund.findMany({
      where: {
        createdAt: { gte: localStart(from), lt: localEndExclusive(to) },
        folio: { reservationItem: { reservation: { propertyId } } },
      },
      select: { amount: true },
    });
    return rows.reduce((s, r) => s + r.amount, 0n);
  }
}
