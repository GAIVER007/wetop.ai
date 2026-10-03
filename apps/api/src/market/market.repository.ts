import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import {
  LUXX_APARTS_PROPERTY,
  MarketInputError,
  type CompetitorInput,
  type MarketReading,
  type ObservationSource,
} from '@pms/domain';
import { auditUserId } from '../accounts/actor';
import { PrismaService } from '../database/prisma.provider';
import { propertyIdRef, propertyToday } from '../database/property-ref';

/** Конкурент объекта (DATA_MODEL §23) */
export interface CompetitorRecord {
  id: string;
  name: string;
  distanceM: number | null;
  unitsTotal: number | null;
  url: string | null;
  note: string | null;
  active: boolean;
}

/** Строка журнала, которую запись пишет той же транзакцией */
export interface MarketAudit {
  entityType: string;
  entityId?: string;
  action: string;
  after: Record<string, unknown>;
}

/** Порт раздела «Загрузка конкурентов»: конкуренты и снимки объекта scope; своя загрузка: у календаря */
export interface MarketRepository {
  today(): Promise<string>;
  competitors(): Promise<CompetitorRecord[]>;
  createCompetitor(c: CompetitorInput & { name: string }, audit: MarketAudit): Promise<string>;
  /** false: конкурента нет у этого объекта */
  updateCompetitor(
    id: string,
    patch: CompetitorInput & { active?: boolean },
    audit: MarketAudit,
  ): Promise<boolean>;
  /** Снимки ночей [from, to] с днём снимка не позже asOf */
  readings(from: string, to: string, asOf: string): Promise<MarketReading[]>;
  /** Все снимки одной ночи действующих конкурентов, по всем дням снимка (история ночи, M1.2) */
  nightReadings(stayDate: string): Promise<MarketReading[]>;
  /**
   * Снимки дня `observedOn`: значение заменяет прежнее за этот день, null снимает его. Одной транзакцией с журналом.
   * false: конкурента нет у этого объекта или он в архиве.
   */
  writeReadings(
    competitorId: string,
    observedOn: string,
    entries: Array<{ date: string; bp: number | null }>,
    source: ObservationSource,
    audit: MarketAudit,
  ): Promise<boolean>;
}
export const MARKET_REPOSITORY = Symbol('MARKET_REPOSITORY');

const asDate = (d: string) => new Date(`${d}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const toRecord = (c: {
  id: string;
  name: string;
  distanceM: number | null;
  unitsTotal: number | null;
  url: string | null;
  note: string | null;
  active: boolean;
}): CompetitorRecord => ({
  id: c.id,
  name: c.name,
  distanceM: c.distanceM,
  unitsTotal: c.unitsTotal,
  url: c.url,
  note: c.note,
  active: c.active,
});

type Tx = Parameters<Parameters<PrismaService['db']['$transaction']>[0]>[0];

async function writeAudit(tx: Tx, a: MarketAudit, createdId?: string): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: auditUserId(),
      entityType: a.entityType,
      entityId: a.entityId ?? createdId ?? '',
      action: a.action,
      after: JSON.parse(JSON.stringify(createdId ? { ...a.after, competitorId: createdId } : a.after)),
    },
  });
}

@Injectable()
export class PrismaMarketRepository implements MarketRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private propertyId(): Promise<string> {
    return propertyIdRef(this.prisma.db, LUXX_APARTS_PROPERTY.name);
  }

  today(): Promise<string> {
    return propertyToday(this.prisma.db, LUXX_APARTS_PROPERTY.name);
  }

  async competitors(): Promise<CompetitorRecord[]> {
    const propertyId = await this.propertyId();
    const rows = await this.prisma.db.competitor.findMany({
      where: { propertyId },
      orderBy: [{ name: 'asc' }],
    });
    return rows.map(toRecord);
  }

  async createCompetitor(c: CompetitorInput & { name: string }, audit: MarketAudit): Promise<string> {
    const propertyId = await this.propertyId();
    try {
      return await this.prisma.db.$transaction(async (tx) => {
        const row = await tx.competitor.create({
          data: {
            propertyId,
            name: c.name,
            distanceM: c.distanceM ?? null,
            unitsTotal: c.unitsTotal ?? null,
            url: c.url ?? null,
            note: c.note ?? null,
            createdById: auditUserId(),
          },
          select: { id: true },
        });
        await writeAudit(tx, audit, row.id);
        return row.id;
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002')
        throw new MarketInputError(`Конкурент «${c.name}» уже есть в списке`);
      throw e;
    }
  }

  async updateCompetitor(
    id: string,
    patch: CompetitorInput & { active?: boolean },
    audit: MarketAudit,
  ): Promise<boolean> {
    const propertyId = await this.propertyId();
    const found = await this.prisma.db.competitor.findFirst({ where: { id, propertyId } });
    if (!found) return false;
    try {
      await this.prisma.db.$transaction(async (tx) => {
        await tx.competitor.update({ where: { id }, data: patch });
        await writeAudit(tx, audit);
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002')
        throw new MarketInputError(`Конкурент «${patch.name}» уже есть в списке`);
      throw e;
    }
    return true;
  }

  async readings(from: string, to: string, asOf: string): Promise<MarketReading[]> {
    const propertyId = await this.propertyId();
    const rows = await this.prisma.db.competitorOccupancy.findMany({
      where: {
        propertyId,
        stayDate: { gte: asDate(from), lte: asDate(to) },
        observedOn: { lte: asDate(asOf) },
        competitor: { active: true },
      },
      select: {
        competitorId: true,
        stayDate: true,
        observedOn: true,
        occupancyBp: true,
        source: true,
      },
    });
    return rows.map((r) => ({
      competitorId: r.competitorId,
      stayDate: iso(r.stayDate),
      observedOn: iso(r.observedOn),
      occupancyBp: r.occupancyBp,
      source: r.source,
    }));
  }

  async nightReadings(stayDate: string): Promise<MarketReading[]> {
    const propertyId = await this.propertyId();
    const rows = await this.prisma.db.competitorOccupancy.findMany({
      where: { propertyId, stayDate: asDate(stayDate), competitor: { active: true } },
      orderBy: { observedOn: 'asc' },
      select: { competitorId: true, stayDate: true, observedOn: true, occupancyBp: true, source: true },
    });
    return rows.map((r) => ({
      competitorId: r.competitorId,
      stayDate: iso(r.stayDate),
      observedOn: iso(r.observedOn),
      occupancyBp: r.occupancyBp,
      source: r.source,
    }));
  }

  async writeReadings(
    competitorId: string,
    observedOn: string,
    entries: Array<{ date: string; bp: number | null }>,
    source: ObservationSource,
    audit: MarketAudit,
  ): Promise<boolean> {
    const propertyId = await this.propertyId();
    const found = await this.prisma.db.competitor.findFirst({
      where: { id: competitorId, propertyId, active: true },
      select: { id: true },
    });
    if (!found) return false;
    const day = asDate(observedOn);
    const createdById = auditUserId();
    await this.prisma.db.$transaction(async (tx) => {
      for (const e of entries) {
        const key = { competitorId, stayDate: asDate(e.date), observedOn: day };
        if (e.bp === null) {
          await tx.competitorOccupancy.deleteMany({ where: { ...key, propertyId } });
          continue;
        }
        await tx.competitorOccupancy.upsert({
          where: { competitorId_stayDate_observedOn: key },
          create: { ...key, propertyId, occupancyBp: e.bp, source, createdById },
          update: { occupancyBp: e.bp, source, createdById, observedAt: new Date() },
        });
      }
      await writeAudit(tx, audit);
    });
    return true;
  }
}
