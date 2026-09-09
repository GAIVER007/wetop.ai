import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import { LUXX_APARTS_PROPERTY } from '@pms/imports';
import { PrismaService } from '../database/prisma.provider';

export interface RateCalendarDay {
  date: string;
  /** occupancy → integer minor units как строка */
  prices: Record<string, string>;
  minStay: number | null;
  maxStay: number | null;
  stopSell: boolean;
  closedToArrival: boolean;
  closedToDeparture: boolean;
}
export interface RateChange {
  accommodationTypeCode: string;
  ratePlanCode: string;
  dateFrom: string;
  dateTo: string;
  /** Дни недели mo…su; пусто = все */
  days?: Array<'mo' | 'tu' | 'we' | 'th' | 'fr' | 'sa' | 'su'> | undefined;
  /** Цена в minor units; undefined — не менять; occupancy — если задана, только для неё, иначе для всех 1…вместимость */
  priceMinor?: bigint;
  occupancy?: number;
  minStay?: number | null;
  maxStay?: number | null;
  stopSell?: boolean;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
}
export interface RatesRepository {
  categories(): Promise<Array<{ id: string; code: string; name: string; capacityAdults: number }>>;
  ratePlans(): Promise<
    Array<{ id: string; code: string; name: string; currency: string; active: boolean }>
  >;
  calendar(
    accommodationTypeId: string,
    ratePlanId: string,
    from: string,
    to: string,
  ): Promise<RateCalendarDay[]>;
  /** Применить изменения одной транзакцией; вернуть число затронутых дат */
  applyChanges(
    changes: Array<
      RateChange & { accommodationTypeId: string; ratePlanId: string; capacityAdults: number }
    >,
  ): Promise<{ rateRows: number; restrictionRows: number }>;
  audit(action: string, after: unknown): Promise<void>;
}
export const RATES_REPOSITORY = Symbol('RATES_REPOSITORY');

const WEEKDAY: Record<string, number> = { su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6 };
const asDate = (d: string) => new Date(`${d}T00:00:00Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);
/** Даты диапазона [from, to] с фильтром по дням недели. */
export function expandDates(from: string, to: string, days?: string[]): string[] {
  const out: string[] = [];
  const allow = days?.length ? new Set(days.map((d) => WEEKDAY[d])) : null;
  for (let x = asDate(from); x <= asDate(to); x.setUTCDate(x.getUTCDate() + 1)) {
    if (!allow || allow.has(x.getUTCDay())) out.push(iso(x));
  }
  return out;
}

@Injectable()
export class PrismaRatesRepository implements RatesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private async propertyId(): Promise<string> {
    const p = await this.prisma.db.property.findFirstOrThrow({
      where: { name: LUXX_APARTS_PROPERTY.name },
      select: { id: true },
    });
    return p.id;
  }
  async categories() {
    const propertyId = await this.propertyId();
    return this.prisma.db.accommodationType.findMany({
      where: { propertyId, active: true },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, capacityAdults: true },
    });
  }
  async ratePlans() {
    const propertyId = await this.propertyId();
    return this.prisma.db.ratePlan.findMany({
      where: { propertyId },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, currency: true, active: true },
    });
  }
  async calendar(
    accommodationTypeId: string,
    ratePlanId: string,
    from: string,
    to: string,
  ): Promise<RateCalendarDay[]> {
    const range = { gte: asDate(from), lte: asDate(to) };
    const [rates, restrictions] = await Promise.all([
      this.prisma.db.dailyRate.findMany({
        where: { accommodationTypeId, ratePlanId, date: range },
      }),
      this.prisma.db.restriction.findMany({
        where: { accommodationTypeId, ratePlanId, date: range },
      }),
    ]);
    return expandDates(from, to).map((date) => {
      const r = restrictions.find((x) => iso(x.date) === date);
      const prices: Record<string, string> = {};
      for (const dr of rates)
        if (iso(dr.date) === date) prices[String(dr.occupancy)] = dr.price.toString();
      return {
        date,
        prices,
        minStay: r?.minStay ?? null,
        maxStay: r?.maxStay ?? null,
        stopSell: r?.stopSell ?? false,
        closedToArrival: r?.closedToArrival ?? false,
        closedToDeparture: r?.closedToDeparture ?? false,
      };
    });
  }
  async applyChanges(
    changes: Array<
      RateChange & { accommodationTypeId: string; ratePlanId: string; capacityAdults: number }
    >,
  ) {
    return this.prisma.db.$transaction(
      async (tx) => {
        let rateRows = 0;
        let restrictionRows = 0;
        for (const c of changes) {
          const dates = expandDates(c.dateFrom, c.dateTo, c.days);
          const occupancies = c.occupancy
            ? [c.occupancy]
            : Array.from({ length: c.capacityAdults }, (_, i) => i + 1);
          for (const date of dates) {
            if (c.priceMinor !== undefined) {
              for (const occupancy of occupancies) {
                await tx.dailyRate.upsert({
                  where: {
                    date_accommodationTypeId_ratePlanId_occupancy: {
                      date: asDate(date),
                      accommodationTypeId: c.accommodationTypeId,
                      ratePlanId: c.ratePlanId,
                      occupancy,
                    },
                  },
                  create: {
                    date: asDate(date),
                    accommodationTypeId: c.accommodationTypeId,
                    ratePlanId: c.ratePlanId,
                    occupancy,
                    price: c.priceMinor,
                  },
                  update: { price: c.priceMinor },
                });
                rateRows += 1;
              }
            }
            const patch = {
              ...(c.minStay !== undefined ? { minStay: c.minStay } : {}),
              ...(c.maxStay !== undefined ? { maxStay: c.maxStay } : {}),
              ...(c.stopSell !== undefined ? { stopSell: c.stopSell } : {}),
              ...(c.closedToArrival !== undefined ? { closedToArrival: c.closedToArrival } : {}),
              ...(c.closedToDeparture !== undefined
                ? { closedToDeparture: c.closedToDeparture }
                : {}),
            };
            if (Object.keys(patch).length) {
              await tx.restriction.upsert({
                where: {
                  date_accommodationTypeId_ratePlanId: {
                    date: asDate(date),
                    accommodationTypeId: c.accommodationTypeId,
                    ratePlanId: c.ratePlanId,
                  },
                },
                create: {
                  date: asDate(date),
                  accommodationTypeId: c.accommodationTypeId,
                  ratePlanId: c.ratePlanId,
                  ...patch,
                },
                update: patch,
              });
              restrictionRows += 1;
            }
          }
        }
        return { rateRows, restrictionRows };
      },
      { timeout: 120_000, maxWait: 10_000 },
    );
  }
  async audit(action: string, after: unknown): Promise<void> {
    await this.prisma.db.auditLog.create({
      data: {
        entityType: 'Property',
        entityId: await this.propertyId(),
        action,
        after: JSON.parse(JSON.stringify(after)),
      },
    });
  }
}
