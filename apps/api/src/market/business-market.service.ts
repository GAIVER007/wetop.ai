import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BUSINESS_MARKET_MAX_COMPETITORS,
  BUSINESS_MARKET_MAX_DAYS,
  MarketInputError,
  buildBusinessMarketBoard,
  canWrite,
  isIsoDate,
  parseLocationCompetitorInput,
  parseSnapshotInput,
  type AvailabilityLevel,
  type BusinessMarketBoard,
  type LocationCompetitorInput,
  type ObservationSource,
} from '@pms/domain';
import { auditUserId } from '../accounts/actor';
import { currentLocationId, currentOrganizationId, hasSignedInActor } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';

/**
 * Загрузка конкурентов салона и ресторана (DATA_MODEL §60, миграция 150). Филиал берётся только из проверенного
 * указателя (как бюджет маркетинга), тело запроса филиал не выбирает; гостиница сюда не ходит (у неё §23, `/market`).
 */
export const CHOOSE_LOCATION = 'Выберите филиал';

export interface BusinessMarketScope {
  organizationId: string;
  businessId: string;
  locationId: string;
  timezone: string;
}

export interface LocationCompetitorRow {
  id: string;
  name: string;
  address: string | null;
  distanceM: number | null;
  url: string | null;
  note: string | null;
  active: boolean;
}

type Tx = Parameters<Parameters<PrismaService['db']['$transaction']>[0]>[0];

const COMPETITOR_SELECT = { id: true, name: true, address: true, distanceM: true, url: true, note: true, active: true } as const;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const day = (s: string) => new Date(`${s}T00:00:00Z`);
/** Сегодня в IANA-поясе филиала (AGENTS.md §13) */
const todayIn = (timezone: string): string => new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());

function rule<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof MarketInputError) throw new BadRequestException(e.message);
    throw e;
  }
}

async function audit(tx: Tx, entityId: string, action: string, after: Record<string, unknown>): Promise<void> {
  await tx.auditLog.create({
    data: { userId: auditUserId(), entityType: 'location_competitor', entityId, action, after: JSON.parse(JSON.stringify(after)) },
  });
}

@Injectable()
export class BusinessMarketService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Филиал салона или ресторана своей организации; гостиница и чужой филиал — отказ */
  async scope(): Promise<BusinessMarketScope> {
    const organizationId = currentOrganizationId();
    if (!hasSignedInActor() || !organizationId) throw new ForbiddenException('Войдите в организацию');
    const locationId = currentLocationId();
    if (!locationId) throw new ConflictException(CHOOSE_LOCATION);
    const location = await this.prisma.db.location.findFirst({
      where: { id: locationId, status: 'ACTIVE', business: { organizationId, status: 'ACTIVE' } },
      select: { id: true, timezone: true, business: { select: { id: true, vertical: true } } },
    });
    if (!location) throw new ForbiddenException('Выбранный филиал недоступен: выберите филиал заново');
    if (location.business.vertical !== 'BEAUTY' && location.business.vertical !== 'FOOD_SERVICE')
      throw new ForbiddenException('Раздел для салона и ресторана; у гостиницы «Анализ конкурентов»');
    return { organizationId, businessId: location.business.id, locationId: location.id, timezone: location.timezone };
  }

  private async writable(organizationId: string): Promise<void> {
    const org = await this.prisma.db.organization.findUnique({
      where: { id: organizationId },
      select: { status: true, trialEndsAt: true },
    });
    if (!org || !canWrite(org.status, org.trialEndsAt, new Date()))
      throw new ForbiddenException('Организация доступна только для чтения');
  }

  /** Доска «рынок по дням» от сегодня филиала (или `from`, не раньше сегодня), до 14 дней */
  async board(q: { from?: string | undefined; days?: string | undefined }): Promise<{ today: string; competitors: LocationCompetitorRow[]; board: BusinessMarketBoard }> {
    const s = await this.scope();
    const today = todayIn(s.timezone);
    const from = q.from && isIsoDate(q.from) && q.from >= today ? q.from : today;
    const days = Math.min(Math.max(Number(q.days) || 7, 1), BUSINESS_MARKET_MAX_DAYS);
    const all = await this.prisma.db.locationCompetitor.findMany({
      where: { locationId: s.locationId },
      select: COMPETITOR_SELECT,
      orderBy: [{ active: 'desc' }, { distanceM: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
    });
    const active = all.filter((c) => c.active);
    const end = new Date(day(from));
    end.setUTCDate(end.getUTCDate() + days - 1);
    const snaps = active.length
      ? await this.prisma.db.locationCompetitorSnapshot.findMany({
          where: { locationId: s.locationId, competitorId: { in: active.map((c) => c.id) }, day: { gte: day(from), lte: end } },
          select: { competitorId: true, day: true, observedOn: true, level: true, freeSlots: true, source: true },
        })
      : [];
    const board = buildBusinessMarketBoard({
      from,
      days,
      competitors: active.map((c) => ({ id: c.id, name: c.name, url: c.url, distanceM: c.distanceM })),
      snapshots: snaps.map((r) => ({
        competitorId: r.competitorId,
        day: iso(r.day),
        observedOn: iso(r.observedOn),
        level: r.level as AvailabilityLevel,
        freeSlots: r.freeSlots,
        source: r.source as ObservationSource,
      })),
    });
    return { today, competitors: all, board };
  }

  async createCompetitor(dto: Record<string, unknown>): Promise<LocationCompetitorRow> {
    const s = await this.scope();
    await this.writable(s.organizationId);
    const input = rule(() => parseLocationCompetitorInput(dto, 'create'));
    const count = await this.prisma.db.locationCompetitor.count({ where: { locationId: s.locationId, active: true } });
    if (count >= BUSINESS_MARKET_MAX_COMPETITORS)
      throw new BadRequestException(`Не больше ${BUSINESS_MARKET_MAX_COMPETITORS} конкурентов в филиале`);
    return this.prisma.db
      .$transaction(async (tx) => {
        const row = await tx.locationCompetitor.create({
          data: {
            organizationId: s.organizationId,
            businessId: s.businessId,
            locationId: s.locationId,
            name: input.name!,
            address: input.address ?? null,
            distanceM: input.distanceM ?? null,
            url: input.url ?? null,
            note: input.note ?? null,
            createdById: auditUserId(),
          },
          select: COMPETITOR_SELECT,
        });
        await audit(tx, row.id, 'location_competitor.created', { ...input, locationId: s.locationId });
        return row;
      })
      .catch((e: unknown) => {
        if ((e as { code?: string }).code === 'P2002') throw new ConflictException('Конкурент с таким названием уже есть');
        throw e;
      });
  }

  async updateCompetitor(id: string, dto: Record<string, unknown>): Promise<LocationCompetitorRow> {
    const s = await this.scope();
    await this.writable(s.organizationId);
    const input: LocationCompetitorInput = rule(() => parseLocationCompetitorInput(dto, 'update'));
    const found = await this.prisma.db.locationCompetitor.findFirst({ where: { id, locationId: s.locationId }, select: { id: true } });
    if (!found) throw new NotFoundException('Конкурент не найден');
    return this.prisma.db
      .$transaction(async (tx) => {
        const row = await tx.locationCompetitor.update({ where: { id }, data: input, select: COMPETITOR_SELECT });
        await audit(tx, id, input.active === false ? 'location_competitor.archived' : 'location_competitor.updated', { ...input });
        return row;
      })
      .catch((e: unknown) => {
        if ((e as { code?: string }).code === 'P2002') throw new ConflictException('Конкурент с таким названием уже есть');
        throw e;
      });
  }

  /** Снимок дня вручную: тот же день наблюдения правит прежний снимок (уникальный ключ), источник MANUAL */
  async putSnapshot(competitorId: string, dto: Record<string, unknown>): Promise<{ day: string; level: AvailabilityLevel; freeSlots: number | null }> {
    const s = await this.scope();
    await this.writable(s.organizationId);
    const today = todayIn(s.timezone);
    const input = rule(() => parseSnapshotInput(dto, today));
    const found = await this.prisma.db.locationCompetitor.findFirst({
      where: { id: competitorId, locationId: s.locationId, active: true },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Конкурент не найден');
    await this.prisma.db.$transaction(async (tx) => {
      await tx.locationCompetitorSnapshot.upsert({
        where: { competitorId_day_observedOn: { competitorId, day: day(input.day), observedOn: day(today) } },
        create: {
          organizationId: s.organizationId,
          locationId: s.locationId,
          competitorId,
          day: day(input.day),
          observedOn: day(today),
          level: input.level,
          freeSlots: input.freeSlots,
          source: 'MANUAL',
          createdById: auditUserId(),
        },
        update: { level: input.level, freeSlots: input.freeSlots, source: 'MANUAL', createdById: auditUserId(), observedAt: new Date() },
      });
      await audit(tx, competitorId, 'location_competitor.snapshot', { ...input, observedOn: today });
    });
    return input;
  }
}
