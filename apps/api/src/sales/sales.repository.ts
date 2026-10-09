import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { propertyRef } from '../database/property-ref';
import type { CompetitorsTotals, Period, PeriodTotals } from './sales-summary';

/** Порт хаба «Продажи»: числа объекта scope запроса, как у остальных разделов */
export interface SalesRepository {
  totals(period: Period): Promise<PeriodTotals>;
  competitors(): Promise<CompetitorsTotals>;
}
export const SALES_REPOSITORY = Symbol('SALES_REPOSITORY');

interface TotalsRow {
  offered: bigint;
  booked: bigint;
  revenue: bigint | string | null;
  currency: string | null;
}

@Injectable()
export class PrismaSalesRepository implements SalesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Один запрос на отрезок. Период считается по дате создания намерения в поясе объекта (граница суток не по UTC).
   * Отменённая бронь и «незаезд» в `booked` и выручку не входят: ради такой брони бот выручки не принёс.
   */
  async totals(period: Period): Promise<PeriodTotals> {
    const property = await propertyRef(this.prisma.db, LUXX_APARTS_PROPERTY.name);
    const rows = await this.prisma.db.$queryRaw<TotalsRow[]>`
      SELECT
        count(*) AS offered,
        count(*) FILTER (WHERE i.state = 'CONFIRMED' AND r.status NOT IN ('CANCELLED', 'NO_SHOW')) AS booked,
        COALESCE(sum(r.total_amount) FILTER (WHERE i.state = 'CONFIRMED' AND r.status NOT IN ('CANCELLED', 'NO_SHOW')), 0) AS revenue,
        max(i.currency) AS currency
      FROM seller_booking_intents i
      LEFT JOIN reservations r ON r.id = i.reservation_id
      WHERE i.property_id = ${property.id}::uuid
        AND (i.created_at AT TIME ZONE ${property.timezone})::date BETWEEN ${period.from}::date AND ${period.to}::date`;
    const row = rows[0];
    return {
      offered: Number(row?.offered ?? 0),
      booked: Number(row?.booked ?? 0),
      revenueMinor: BigInt(row?.revenue ?? 0),
      currency: row?.currency ?? null,
    };
  }

  /** Конкуренты под наблюдением: действующие, и день последнего снимка по ним */
  async competitors(): Promise<CompetitorsTotals> {
    const property = await propertyRef(this.prisma.db, LUXX_APARTS_PROPERTY.name);
    const [count, last] = await Promise.all([
      this.prisma.db.competitor.count({ where: { propertyId: property.id, active: true } }),
      this.prisma.db.competitorOccupancy.aggregate({
        where: { propertyId: property.id, competitor: { active: true } },
        _max: { observedOn: true },
      }),
    ]);
    return { count, lastObservedOn: last._max.observedOn?.toISOString().slice(0, 10) ?? null };
  }
}
