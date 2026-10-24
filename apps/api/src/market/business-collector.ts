import 'reflect-metadata';
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { MarketInputError, businessPlatform, parseCollectedDays, todayAt } from '@pms/domain';
import { Access } from '../auth/access.decorator';
import { serviceKeyKind } from '../auth/auth.guard';
import type { SignedInUser } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.provider';
import { COLLECT_KEY_REQUIRED } from './collector.controller';

/**
 * Служебный вход сборщика загрузки соседей салона и ресторана (DATA_MODEL §60, план
 * `plans/2026-10-23-competitors-business-manual.md` срез 2): тот же узкий ключ `MARKET_COLLECT_KEY`, что у гостиницы,
 * ровно два адреса. Филиал, организация и «сегодня» берутся из строки соседа, тело несёт только дни и окна. Источник
 * всегда AI_AGENT; день, который человек сегодня уже ввёл вручную, остаётся за человеком; сборщик ничего не стирает.
 */
export interface BusinessCollectorTarget {
  id: string;
  name: string;
  url: string;
  platform: string;
  locationId: string;
  timezone: string;
}

const day = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class BusinessCollectorService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Действующие соседи со ссылкой на площадку записи или брони, у живых филиалов и бизнесов */
  async targets(where: { id?: string } = {}): Promise<BusinessCollectorTarget[]> {
    const rows = await this.prisma.db.locationCompetitor.findMany({
      where: {
        ...where,
        active: true,
        url: { not: null },
        location: { status: 'ACTIVE', business: { status: 'ACTIVE', vertical: { in: ['BEAUTY', 'FOOD_SERVICE'] } } },
      },
      orderBy: [{ locationId: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, url: true, locationId: true, location: { select: { timezone: true } } },
    });
    return rows.flatMap((r) => {
      const platform = businessPlatform(r.url);
      return platform && r.url
        ? [{ id: r.id, name: r.name, url: r.url, platform, locationId: r.locationId, timezone: r.location.timezone }]
        : [];
    });
  }

  async collect(id: string, dto: { entries?: unknown }, now = new Date()): Promise<{ saved: number; kept: number; observedOn: string }> {
    const target = (await this.targets({ id }))[0];
    if (!target) throw new NotFoundException('Сосед не найден, убран из списка или без ссылки на площадку');
    const today = todayAt(target.timezone, now);
    let entries;
    try {
      entries = parseCollectedDays(dto?.entries, today);
    } catch (e) {
      if (e instanceof MarketInputError) throw new BadRequestException(e.message);
      throw e;
    }
    const competitor = await this.prisma.db.locationCompetitor.findUniqueOrThrow({
      where: { id },
      select: { organizationId: true, locationId: true },
    });
    return this.prisma.db.$transaction(async (tx) => {
      const manual = await tx.locationCompetitorSnapshot.findMany({
        where: { competitorId: id, observedOn: day(today), source: 'MANUAL', day: { in: entries.map((e) => day(e.day)) } },
        select: { day: true },
      });
      const human = new Set(manual.map((m) => iso(m.day)));
      let saved = 0;
      for (const e of entries) {
        if (human.has(e.day)) continue;
        const values = { level: e.level, freeSlots: e.freeSlots, source: 'AI_AGENT' as const, createdById: null };
        await tx.locationCompetitorSnapshot.upsert({
          where: { competitorId_day_observedOn: { competitorId: id, day: day(e.day), observedOn: day(today) } },
          create: { organizationId: competitor.organizationId, locationId: competitor.locationId, competitorId: id, day: day(e.day), observedOn: day(today), ...values },
          update: { ...values, observedAt: new Date() },
        });
        saved += 1;
      }
      await tx.auditLog.create({
        data: {
          userId: null,
          entityType: 'location_competitor',
          entityId: id,
          action: 'location_competitor.collected',
          after: JSON.parse(JSON.stringify({ observedOn: today, source: 'AI_AGENT', platform: target.platform, entries, saved, kept: human.size })),
        },
      });
      return { saved, kept: human.size, observedOn: today };
    });
  }
}

type ServiceRequest = { headers: Record<string, unknown>; user?: SignedInUser };

function collectKeyOnly(request: ServiceRequest): void {
  const key = serviceKeyKind(request.headers);
  if (key === null && !request.user) throw new UnauthorizedException(COLLECT_KEY_REQUIRED);
  if (key !== 'market-collect' && key !== 'service') throw new ForbiddenException(COLLECT_KEY_REQUIRED);
}

@Access('service')
@Controller('business-market/collector')
export class BusinessCollectorController {
  constructor(@Inject(BusinessCollectorService) private readonly service: BusinessCollectorService) {}

  @Get('competitors')
  async competitors(@Req() request: ServiceRequest) {
    collectKeyOnly(request);
    return { competitors: await this.service.targets() };
  }

  @Put('competitors/:id/days')
  @HttpCode(200)
  collect(@Req() request: ServiceRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: { entries?: unknown }) {
    collectKeyOnly(request);
    return this.service.collect(id, dto ?? {});
  }
}
