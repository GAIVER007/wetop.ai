import 'reflect-metadata';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  MarketingBudgetError,
  isoDate,
  parseCampaignInput,
  parseCampaignStatsCsv,
  parseCampaignStatsInput,
} from '@pms/domain';
import { auditUserId } from '../accounts/actor';
import { Access } from '../auth/access.decorator';
import { PrismaService } from '../database/prisma.provider';
import { MARKETING_BUDGET_REPOSITORY, type MarketingBudgetRepository } from './marketing-budget.repository';

/**
 * Рекламные кампании филиала и их статистика по дням (DATA_MODEL §53, ADR-MKT-B3). Показы, клики и лиды площадки
 * вводятся вручную или CSV; деньги кампании это её учтённые расходы месяца из журнала (§41.1), отдельной суммы нет.
 * Показатели (CTR, CPC, CPM, CPL площадки) считает стойка доменной `campaignMetrics`.
 */
const MONTH = /^(\d{4})-(\d{2})$/;
const asDate = (d: string) => new Date(`${d}T00:00:00Z`);
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const nextMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
};
const rule = <T>(fn: () => T): T => {
  try {
    return fn();
  } catch (e) {
    if (e instanceof MarketingBudgetError) throw new BadRequestException(e.message);
    throw e;
  }
};
const isUnique = (e: unknown) =>
  typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';
const DUPLICATE = 'Кампания с таким названием на этой площадке уже есть';

export interface CampaignView {
  id: string;
  platform: string;
  name: string;
  status: string;
  startsOn: string | null;
  endsOn: string | null;
  /** Учтённый расход кампании за месяц, minor units валюты отчётности */
  spend: string;
  impressions: number;
  clicks: number;
  leads: number;
  /** Кампания из рекламного кабинета (§55): правит только сверка */
  fromCabinet: boolean;
  /** Расход по кабинету за месяц, minor units его валюты; null у ручных кампаний */
  cabinetSpend: string | null;
  cabinetCurrency: string | null;
  /** Дни месяца со статистикой, по возрастанию */
  days: Array<{ date: string; impressions: number; clicks: number; leads: number }>;
}

@Injectable()
export class MarketingCampaignsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MARKETING_BUDGET_REPOSITORY) private readonly repo: MarketingBudgetRepository,
  ) {}

  private async writable() {
    const scope = await this.repo.scope();
    await this.repo.assertWritable(scope.organizationId);
    return scope;
  }

  /**
   * Ручная кампания своего филиала; чужая и несуществующая неразличимы: 404. Кампанию из кабинета (§55) и её дни
   * меняет только сверка, иначе ручная правка тихо перезаписалась бы ночью: 409 словами.
   */
  private async own(locationId: string, id: string) {
    const c = await this.prisma.db.marketingCampaign.findFirst({
      where: { id, locationId },
      select: { id: true, externalId: true },
    });
    if (!c) throw new NotFoundException('Кампания не найдена');
    if (c.externalId !== null)
      throw new ConflictException('Кампания из рекламного кабинета обновляется сверкой: меняйте её в кабинете площадки');
    return c.id;
  }

  private audit(tx: Pick<PrismaService['db'], 'auditLog'>, campaignId: string, action: string, after: object) {
    return tx.auditLog.create({
      data: {
        userId: auditUserId(),
        entityType: 'marketing_campaign',
        entityId: campaignId,
        action,
        after: JSON.parse(JSON.stringify(after)),
      },
    });
  }

  async list(
    month?: string,
  ): Promise<{ month: string; today: string; reportingCurrency: string; campaigns: CampaignView[] }> {
    const scope = await this.repo.scope();
    // сегодня в поясе филиала: день по умолчанию у ввода статистики (AGENTS.md §13)
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: scope.timezone }).format(new Date());
    const window = month ?? today.slice(0, 7);
    if (!MONTH.test(window)) throw new BadRequestException('Месяц: в виде ГГГГ-ММ');
    const first = asDate(`${window}-01`);
    const next = asDate(nextMonth(window));
    const [campaigns, spend] = await Promise.all([
      this.prisma.db.marketingCampaign.findMany({
        where: { locationId: scope.locationId },
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        include: {
          stats: {
            where: { date: { gte: first, lt: next } },
            orderBy: { date: 'asc' },
            select: { date: true, impressions: true, clicks: true, leads: true, spendMinor: true, spendCurrency: true },
          },
        },
      }),
      this.prisma.db.marketingExpense.groupBy({
        by: ['campaignId'],
        where: { locationId: scope.locationId, countedInBudget: true, campaignId: { not: null }, date: { gte: first, lt: next } },
        _sum: { baseAmount: true },
      }),
    ]);
    const spendBy = new Map(spend.map((s) => [s.campaignId, s._sum.baseAmount ?? 0n]));
    return {
      month: window,
      today,
      reportingCurrency: scope.reportingCurrency,
      campaigns: campaigns.map((c) => ({
        id: c.id,
        platform: c.platform,
        name: c.name,
        status: c.status,
        startsOn: iso(c.startsOn),
        endsOn: iso(c.endsOn),
        spend: (spendBy.get(c.id) ?? 0n).toString(),
        impressions: c.stats.reduce((s, d) => s + d.impressions, 0),
        clicks: c.stats.reduce((s, d) => s + d.clicks, 0),
        leads: c.stats.reduce((s, d) => s + d.leads, 0),
        fromCabinet: c.externalId !== null,
        cabinetSpend: c.externalId === null ? null : c.stats.reduce((s, d) => s + (d.spendMinor ?? 0n), 0n).toString(),
        cabinetCurrency: c.externalId === null ? null : (c.stats.find((d) => d.spendCurrency)?.spendCurrency ?? null),
        days: c.stats.map((d) => ({ date: iso(d.date)!, impressions: d.impressions, clicks: d.clicks, leads: d.leads })),
      })),
    };
  }

  async create(dto: Record<string, unknown>): Promise<{ id: string }> {
    const scope = await this.writable();
    const input = rule(() => parseCampaignInput(dto));
    try {
      return await this.prisma.db.$transaction(async (tx) => {
        const c = await tx.marketingCampaign.create({
          data: {
            locationId: scope.locationId,
            platform: input.platform,
            name: input.name,
            status: input.status,
            startsOn: input.startsOn ? asDate(input.startsOn) : null,
            endsOn: input.endsOn ? asDate(input.endsOn) : null,
          },
          select: { id: true },
        });
        await this.audit(tx, c.id, 'marketing_campaign.created', { ...input, locationId: scope.locationId });
        return c;
      });
    } catch (e) {
      if (isUnique(e)) throw new ConflictException(DUPLICATE);
      throw e;
    }
  }

  async update(id: string, dto: Record<string, unknown>): Promise<{ id: string }> {
    const scope = await this.writable();
    const input = rule(() => parseCampaignInput(dto));
    const campaignId = await this.own(scope.locationId, id);
    try {
      await this.prisma.db.$transaction(async (tx) => {
        await tx.marketingCampaign.update({
          where: { id: campaignId },
          data: {
            platform: input.platform,
            name: input.name,
            status: input.status,
            startsOn: input.startsOn ? asDate(input.startsOn) : null,
            endsOn: input.endsOn ? asDate(input.endsOn) : null,
          },
        });
        // текст кампании у расходов следует за её именем: журнал и выгрузка показывают актуальное
        await tx.marketingExpense.updateMany({ where: { campaignId }, data: { campaign: input.name } });
        await this.audit(tx, campaignId, 'marketing_campaign.updated', input);
      });
    } catch (e) {
      if (isUnique(e)) throw new ConflictException(DUPLICATE);
      throw e;
    }
    return { id: campaignId };
  }

  /** День статистики: ввод заменяет строку дня */
  async setDay(id: string, dto: Record<string, unknown>) {
    const scope = await this.writable();
    const input = rule(() => parseCampaignStatsInput(dto));
    const campaignId = await this.own(scope.locationId, id);
    await this.prisma.db.$transaction(async (tx) => {
      const data = { impressions: input.impressions, clicks: input.clicks, leads: input.leads };
      await tx.marketingCampaignStat.upsert({
        where: { campaignId_date: { campaignId, date: asDate(input.date) } },
        create: { campaignId, date: asDate(input.date), ...data },
        update: data,
      });
      await this.audit(tx, campaignId, 'marketing_campaign.stats_set', input);
    });
    return input;
  }

  async removeDay(id: string, date: string): Promise<{ deleted: true }> {
    const scope = await this.writable();
    const day = rule(() => isoDate(date, 'Дата'));
    const campaignId = await this.own(scope.locationId, id);
    await this.prisma.db.$transaction(async (tx) => {
      const gone = await tx.marketingCampaignStat.deleteMany({ where: { campaignId, date: asDate(day) } });
      if (gone.count === 0) throw new NotFoundException('За этот день статистики нет');
      await this.audit(tx, campaignId, 'marketing_campaign.stats_removed', { date: day });
    });
    return { deleted: true };
  }

  /** CSV статистики одной кампании: всё или ничего, дни из файла заменяют введённые */
  async importDays(id: string, dto: Record<string, unknown>): Promise<{ imported: number }> {
    const scope = await this.writable();
    if (typeof dto.csv !== 'string') throw new BadRequestException('Нужен текст CSV-файла');
    const csv = dto.csv;
    const rows = rule(() => parseCampaignStatsCsv(csv));
    const campaignId = await this.own(scope.locationId, id);
    await this.prisma.db.$transaction(async (tx) => {
      for (const r of rows) {
        const data = { impressions: r.impressions, clicks: r.clicks, leads: r.leads };
        await tx.marketingCampaignStat.upsert({
          where: { campaignId_date: { campaignId, date: asDate(r.date) } },
          create: { campaignId, date: asDate(r.date), ...data },
          update: data,
        });
      }
      await this.audit(tx, campaignId, 'marketing_campaign.stats_imported', {
        days: rows.length,
        from: rows[0]!.date,
        to: rows[rows.length - 1]!.date,
      });
    });
    return { imported: rows.length };
  }
}

/** Право всего раздела «Маркетинг» (ADR-MKT-B7) */
@Access('marketing')
@Controller('marketing/campaigns')
export class MarketingCampaignsController {
  constructor(@Inject(MarketingCampaignsService) private readonly campaigns: MarketingCampaignsService) {}

  @Get()
  list(@Query('month') month?: string) {
    return this.campaigns.list(month);
  }

  @Post()
  create(@Body() dto: Record<string, unknown>) {
    return this.campaigns.create(dto ?? {});
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Record<string, unknown>) {
    return this.campaigns.update(id, dto ?? {});
  }

  @Put(':id/stats')
  @HttpCode(200)
  setDay(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Record<string, unknown>) {
    return this.campaigns.setDay(id, dto ?? {});
  }

  @Post(':id/stats/import')
  @HttpCode(200)
  importDays(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Record<string, unknown>) {
    return this.campaigns.importDays(id, dto ?? {});
  }

  @Delete(':id/stats/:date')
  removeDay(@Param('id', ParseUUIDPipe) id: string, @Param('date') date: string) {
    return this.campaigns.removeDay(id, date);
  }
}
