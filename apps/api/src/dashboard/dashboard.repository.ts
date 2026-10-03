import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import type {
  DashboardCharge,
  DashboardDay,
  DashboardPayment,
  DashboardStay,
  DashboardUnitKind,
  UnitBoardTally,
} from '@pms/domain';
import { LUXX_APARTS_PROPERTY, zonedStartOfDay } from '@pms/domain';
import { channex } from '@pms/integrations';
import { PrismaService } from '../database/prisma.provider';
import { ChessboardService } from '../chessboard/chessboard.service';
import { propertyIdRef, propertyRef } from '../database/property-ref';

export interface DashboardBoard {
  /** Тип категории — по её единицам в шахматке: номер или койка (Аналитика v2, тип фонда) */
  categories: Array<{ code: string; name: string; units: number; kind: DashboardUnitKind }>;
  days: DashboardDay[];
  /** Проживания без ячейки по коду категории — одно проживание считается один раз */
  unassignedByCategory: Record<string, number>;
  /** Те же клетки до единицы — для «По номерам» (REP3): ночи, блокировки, заезды каждого места */
  units: UnitBoardTally[];
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
// С-13 (ТЗ аудита 25.09.2026): границы суток — по Property.timezone, как в финансовом отчёте
const localStart = (d: string, tz: string) => zonedStartOfDay(d, tz);
const localEndExclusive = (d: string, tz: string) => zonedStartOfDay(plusDays(d, 1), tz);

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
  private async timezone(): Promise<string> {
    return (await propertyRef(this.prisma.db, LUXX_APARTS_PROPERTY.name)).timezone;
  }

  /** Та же шахматка, что на экране, кусками по 62 дня (её потолок за запрос) */
  async board(from: string, to: string): Promise<DashboardBoard> {
    const days: DashboardDay[] = [];
    const categories = new Map<
      string,
      { code: string; name: string; units: number; kind: DashboardUnitKind }
    >();
    // ключ → { категория, сколько таких проживаний }; одинаковые проживания группы различаются только числом
    const unassigned = new Map<string, { code: string; count: number }>();
    // REP3: те же клетки до единицы; куски не пересекаются — ночи и заезды не задваиваются
    const units = new Map<string, UnitBoardTally>();
    for (let start = from; start <= to; start = plusDays(start, BOARD_CHUNK_DAYS)) {
      const end = [plusDays(start, BOARD_CHUNK_DAYS - 1), to].sort()[0]!;
      const b = await this.chessboard.board(start, end);
      for (const r of b.rows) {
        const u = units.get(r.unit.code) ?? {
          code: r.unit.code,
          categoryCode: r.unit.accommodationTypeCode,
          categoryName: r.unit.accommodationTypeName,
          kind: r.unit.kind,
          occupiedNights: 0,
          blockedNights: 0,
          arrivals: 0,
        };
        for (const cell of r.cells) {
          if (cell.state === 'OCCUPIED') u.occupiedNights += 1;
          else if (cell.state === 'BLOCKED') u.blockedNights += 1;
          if (cell.isArrival) u.arrivals += 1;
        }
        units.set(r.unit.code, u);
      }
      if (!categories.size)
        for (const r of b.rows) {
          const code = r.unit.accommodationTypeCode;
          // категория однородна (номера или койки); тип — по первой её единице
          const c = categories.get(code) ?? {
            code,
            name: r.unit.accommodationTypeName,
            units: 0,
            kind: r.unit.kind,
          };
          categories.set(code, { ...c, units: c.units + 1 });
        }
      for (const date of b.dates)
        days.push({
          date,
          ...(b.summary[date] ?? { occupied: 0, free: 0, blocked: 0 }),
          byCategory: b.byCategory[date] ?? {},
        });
      // Проживание, задевающее два куска, приходит в обоих — считается один раз. Групповая бронь на три
      // койки без места — три одинаковых проживания в каждом куске: берётся их число в куске, а по
      // кускам — наибольшее, а не сумма (одинаковые проживания задевают одни и те же куски).
      const chunk = new Map<string, { code: string; count: number }>();
      for (const u of b.unassigned) {
        const key = `${u.confirmationNumber}|${u.categoryCode}|${u.arrivalDate}|${u.departureDate}`;
        const c = chunk.get(key) ?? { code: u.categoryCode, count: 0 };
        c.count += 1;
        chunk.set(key, c);
      }
      for (const [key, c] of chunk)
        if ((unassigned.get(key)?.count ?? 0) < c.count) unassigned.set(key, c);
    }
    const unassignedByCategory: Record<string, number> = {};
    for (const { code, count } of unassigned.values())
      unassignedByCategory[code] = (unassignedByCategory[code] ?? 0) + count;
    return {
      categories: [...categories.values()],
      days,
      unassignedByCategory,
      units: [...units.values()],
    };
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
        reservationId: true,
        accommodationType: { select: { code: true } },
        reservation: { select: { source: true, channel: true, status: true } },
      },
    });
    return rows.map((r) => ({
      arrivalDate: r.arrivalDate.toISOString().slice(0, 10),
      departureDate: r.departureDate.toISOString().slice(0, 10),
      status: r.status,
      // Q-209: бронь — это Reservation; статус брони решает, отменена она или нет
      reservationId: r.reservationId,
      reservationStatus: r.reservation.status,
      adults: r.adults,
      children: r.children,
      priceMinor: r.price,
      source: r.reservation.source,
      // Один канал Channex присылает под разными именами — на «Главной» он один (plans/channel-name-canonical-2026-09-22.md)
      channel:
        r.reservation.channel === null ? null : channex.otaChannelLabel(r.reservation.channel),
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
        serviceDate: true,
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
      // выборка отобрана по дате услуги в периоде — пустой она здесь не бывает
      serviceDate: (c.serviceDate ?? asDate(from)).toISOString().slice(0, 10),
    }));
  }

  async payments(from: string, to: string): Promise<DashboardPayment[]> {
    const tz = await this.timezone();
    const propertyId = await this.propertyId();
    const rows = await this.prisma.db.payment.findMany({
      where: {
        propertyId,
        status: 'COMPLETED',
        paidAt: { gte: localStart(from, tz), lt: localEndExclusive(to, tz) },
      },
      select: { method: true, amount: true },
    });
    return rows.map((p) => ({ method: p.method, amountMinor: p.amount }));
  }

  async refundsMinor(from: string, to: string): Promise<bigint> {
    const tz = await this.timezone();
    const propertyId = await this.propertyId();
    const rows = await this.prisma.db.refund.findMany({
      where: {
        createdAt: { gte: localStart(from, tz), lt: localEndExclusive(to, tz) },
        folio: { reservationItem: { reservation: { propertyId } } },
      },
      select: { amount: true },
    });
    return rows.reduce((s, r) => s + r.amount, 0n);
  }
}
