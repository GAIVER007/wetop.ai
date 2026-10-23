import 'reflect-metadata';
import {
  BadGatewayException,
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import {
  CONTENT_CHANNELS,
  CONTENT_TONES,
  ContentDraftError,
  availableContentCtas,
  buildSiteFacts,
  canWrite,
  checkDraftFacts,
  composeContentPost,
  contentFactsOf,
  normalizeContentDraft,
  normalizeContentVariants,
  parseSitesBaseDomain,
  platformHost,
  type ContentChannel,
  type ContentContacts,
  type ContentCta,
  type ContentDraftInput,
  type ContentTone,
  type SiteFactsVertical,
} from '@pms/domain';
import { assistant } from '@pms/integrations';
import { auditUserId } from '../accounts/actor';
import { sellerConfigFromEnv } from '../ai-seller/seller.connection';
import { Access } from '../auth/access.decorator';
import {
  currentLocationId,
  currentOrganizationId,
  currentUserId,
  hasSignedInActor,
} from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { readSiteFactsSnapshot } from '../marketing-site/site-facts.service';

/**
 * «Маркетинг → Контент»: черновики постов (docs/marketing/content-drafts-proposal.md, утверждено 23.10.2026).
 * ИИ предлагает 1–2 варианта (`content-draft/0`), домен приводит их к правилам и помечает цифры не из карточки;
 * сохраняет только человек. Ссылку брони, телефон и адрес подставляет домен по кнопке из данных филиала.
 * Филиал строго из входа, правка по `expectedRevision`, повтор создания по `creationId`, удаления нет.
 */
export const CONTENT_BOT = Symbol('CONTENT_BOT');
export const CONTENT_CONTEXT = Symbol('CONTENT_CONTEXT');
export const CONTENT_STORE = Symbol('CONTENT_STORE');

export interface ContentBotRequest {
  schemaVersion: 'content-draft/0';
  requestId: string;
  topic: string;
  channel: ContentChannel;
  tone: ContentTone;
  business: { vertical: string; name: string; city: string; country: string; language: 'ru' | 'kk' | 'en' };
  facts: string[];
  ctas: ContentCta[];
  budgetRemainingTokens: number;
}

export interface ContentBot {
  propose(request: ContentBotRequest): Promise<unknown>;
}

export interface ContentContext {
  organizationId: string;
  locationId: string;
  userId: string | null;
  timezone: string;
  vertical: string;
  name: string;
  city: string | null;
  facts: string[];
  contacts: ContentContacts;
}

export interface ContentContextReader {
  current(): Promise<ContentContext>;
  assertWritable(organizationId: string): Promise<void>;
}

export interface ContentDraftRow extends ContentDraftInput {
  id: string;
  locationId: string;
  creationId: string;
  createdById?: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export type ContentDraftPatch = Partial<
  Pick<ContentDraftRow, 'channel' | 'topic' | 'title' | 'body' | 'hashtags' | 'cta' | 'plannedOn' | 'status' | 'publishedAt'>
>;

export interface ContentStore {
  /** Не архивные черновики филиала: с днём в [from, to] и без дня */
  list(locationId: string, from: string, to: string): Promise<ContentDraftRow[]>;
  find(locationId: string, id: string): Promise<ContentDraftRow | null>;
  /** Повтор того же creationId в филиале возвращает прежнюю строку */
  create(
    row: ContentDraftInput & { locationId: string; creationId: string; createdById: string | null },
  ): Promise<{ row: ContentDraftRow; created: boolean }>;
  /** null: нет строки, версия устарела или черновик в архиве */
  update(locationId: string, id: string, expectedRevision: number, patch: ContentDraftPatch): Promise<ContentDraftRow | null>;
}

export function contentBotFromEnv(): ContentBot | null {
  const config = sellerConfigFromEnv();
  if (!config.baseUrl || !config.serviceKey) return null;
  const client = new assistant.BotPanelClient({ baseUrl: config.baseUrl, serviceKey: config.serviceKey });
  return { propose: (req) => client.contentDraft({ ...req }) };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** Потолок расхода одного черновика: как у предложения рекламы (Q-CONTENT-3) */
const DRAFT_BUDGET_TOKENS = 60_000;
const UNAVAILABLE = 'ИИ сейчас недоступен: попробуйте позже или напишите пост сами';
const UNREADABLE = 'ИИ ответил не по делу: попробуйте ещё раз или напишите пост сами';
const STALE = 'Черновик уже изменили в другом окне: обновите страницу';
const GONE = 'Черновик не найден';

const bad = (msg: string): never => {
  throw new BadRequestException(msg);
};
const rule = <T>(fn: () => T): T => {
  try {
    return fn();
  } catch (e) {
    if (e instanceof ContentDraftError) throw new BadRequestException(e.message);
    throw e;
  }
};
const revisionOf = (v: unknown) => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) bad('Нужна версия черновика: обновите страницу');
  return v as number;
};
const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

@Injectable()
export class ContentDraftsService {
  constructor(
    @Inject(CONTENT_CONTEXT) private readonly context: ContentContextReader,
    @Inject(CONTENT_STORE) private readonly store: ContentStore,
    @Optional() @Inject(CONTENT_BOT) private readonly bot: ContentBot | null,
  ) {}

  private view(row: ContentDraftRow, contacts: ContentContacts) {
    return { ...row, preview: composeContentPost(row, contacts) };
  }

  private async writable() {
    const ctx = await this.context.current();
    await this.context.assertWritable(ctx.organizationId);
    return ctx;
  }

  async propose(raw: unknown) {
    const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const topic = typeof b.topic === 'string' ? b.topic.trim() : '';
    if (!topic) bad('Напишите, о чём пост');
    if (topic.length > 500) bad('О чём пост: до 500 знаков');
    const channel = b.channel as ContentChannel;
    if (!(CONTENT_CHANNELS as readonly string[]).includes(channel)) bad('Выберите канал публикации');
    const tone = b.tone as ContentTone;
    if (!(CONTENT_TONES as readonly string[]).includes(tone)) bad('Выберите тон');
    const ctx = await this.writable();
    if (!this.bot) throw new ServiceUnavailableException(UNAVAILABLE);
    const ctas = availableContentCtas(ctx.contacts);
    let reply: unknown;
    try {
      reply = await this.bot.propose({
        schemaVersion: 'content-draft/0',
        requestId: randomUUID(),
        topic,
        channel,
        tone,
        business: { vertical: ctx.vertical, name: ctx.name, city: ctx.city ?? '', country: 'KZ', language: 'ru' },
        facts: ctx.facts,
        ctas,
        budgetRemainingTokens: DRAFT_BUDGET_TOKENS,
      });
    } catch (error) {
      if (error instanceof assistant.BotUnavailableError) throw new ServiceUnavailableException(UNAVAILABLE);
      if (error instanceof assistant.BotRejectedError) throw new BadGatewayException(`ИИ отклонил запрос: ${error.detail}`);
      throw error;
    }
    const answer = (reply && typeof reply === 'object' ? reply : {}) as Record<string, unknown>;
    if (answer.status !== 'ok') {
      const code = typeof answer.errorCode === 'string' ? answer.errorCode : '';
      if (code === 'SCHEMA_INVALID' || code === 'REJECTED_CONTENT') throw new UnprocessableEntityException(UNREADABLE);
      throw new ServiceUnavailableException(UNAVAILABLE);
    }
    let variants;
    try {
      variants = normalizeContentVariants(answer.spec);
    } catch (e) {
      if (e instanceof ContentDraftError) throw new UnprocessableEntityException(UNREADABLE);
      throw e;
    }
    return {
      variants: variants.map((v) => {
        const cta: ContentCta = ctas.includes(v.cta) ? v.cta : 'NONE';
        return {
          ...v,
          cta,
          warnings: checkDraftFacts(v.body, ctx.facts, topic),
          preview: composeContentPost({ ...v, cta }, ctx.contacts),
        };
      }),
      ctas,
    };
  }

  async week(raw: unknown) {
    const ctx = await this.context.current();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: ctx.timezone }).format(new Date());
    let from: string;
    if (raw === undefined || raw === '') {
      const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
      from = addDays(today, -((dow + 6) % 7));
    } else {
      if (typeof raw !== 'string' || !ISO.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`)))
        bad('Неделя: дата понедельника ГГГГ-ММ-ДД');
      from = raw as string;
      if (new Date(`${from}T00:00:00Z`).getUTCDay() !== 1) bad('Неделя начинается с понедельника');
    }
    const to = addDays(from, 6);
    const rows = await this.store.list(ctx.locationId, from, to);
    return {
      week: { from, to },
      today,
      ctas: availableContentCtas(ctx.contacts),
      items: rows.map((r) => this.view(r, ctx.contacts)),
    };
  }

  async create(raw: unknown, res: Response) {
    const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    if (typeof b.creationId !== 'string' || !UUID.test(b.creationId)) bad('Нужен ключ создания черновика');
    const input = rule(() => normalizeContentDraft(b));
    const ctx = await this.writable();
    const { row, created } = await this.store.create({
      ...input,
      locationId: ctx.locationId,
      creationId: b.creationId as string,
      createdById: ctx.userId,
    });
    res.status(created ? 201 : 200);
    return this.view(row, ctx.contacts);
  }

  private async change(id: string, raw: unknown, patchOf: (row: ContentDraftRow) => ContentDraftPatch) {
    const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const expected = revisionOf(b.expectedRevision);
    const ctx = await this.writable();
    const current = await this.store.find(ctx.locationId, id);
    if (!current) throw new NotFoundException(GONE);
    if (current.status === 'ARCHIVED') throw new ConflictException('Черновик в архиве: создайте новый');
    const updated = await this.store.update(ctx.locationId, id, expected, patchOf(current));
    if (!updated) throw new ConflictException(STALE);
    return this.view(updated, ctx.contacts);
  }

  update(id: string, raw: unknown) {
    const input = rule(() => normalizeContentDraft({ ...(raw as object), origin: 'MANUAL' }));
    return this.change(id, raw, () => ({
      channel: input.channel,
      topic: input.topic,
      title: input.title,
      body: input.body,
      hashtags: input.hashtags,
      cta: input.cta,
      plannedOn: input.plannedOn,
    }));
  }

  published(id: string, raw: unknown) {
    return this.change(id, raw, () => ({ status: 'PUBLISHED', publishedAt: new Date().toISOString() }));
  }

  archive(id: string, raw: unknown) {
    return this.change(id, raw, () => ({ status: 'ARCHIVED' }));
  }
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
type DbRow = {
  id: string;
  locationId: string;
  creationId: string;
  channel: string;
  topic: string;
  title: string | null;
  body: string;
  hashtags: string[];
  cta: string | null;
  origin: string;
  plannedOn: Date | null;
  status: string;
  publishedAt: Date | null;
  revision: number;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
};
const fromDb = (r: DbRow): ContentDraftRow => ({
  id: r.id,
  locationId: r.locationId,
  creationId: r.creationId,
  channel: r.channel as ContentChannel,
  topic: r.topic,
  title: r.title,
  body: r.body,
  hashtags: r.hashtags,
  cta: r.cta as ContentCta | null,
  origin: r.origin as ContentDraftRow['origin'],
  plannedOn: iso(r.plannedOn),
  status: r.status as ContentDraftRow['status'],
  publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
  revision: r.revision,
  createdById: r.createdById,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});
const asDate = (d: string | null | undefined) => (d ? new Date(`${d}T00:00:00Z`) : null);
const isUnique = (e: unknown) => typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';

@Injectable()
export class PrismaContentStore implements ContentStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private audit(tx: Pick<PrismaService['db'], 'auditLog'>, id: string, action: string, after: object) {
    return tx.auditLog.create({
      data: { userId: auditUserId(), entityType: 'content_draft', entityId: id, action, after: JSON.parse(JSON.stringify(after)) },
    });
  }

  async list(locationId: string, from: string, to: string) {
    const rows = await this.prisma.db.contentDraft.findMany({
      where: {
        locationId,
        status: { not: 'ARCHIVED' },
        OR: [{ plannedOn: null }, { plannedOn: { gte: asDate(from)!, lte: asDate(to)! } }],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 200,
    });
    return rows.map(fromDb);
  }

  async find(locationId: string, id: string) {
    const r = await this.prisma.db.contentDraft.findFirst({ where: { id, locationId } });
    return r ? fromDb(r) : null;
  }

  async create(row: ContentDraftInput & { locationId: string; creationId: string; createdById: string | null }) {
    const existing = () =>
      this.prisma.db.contentDraft.findUnique({
        where: { locationId_creationId: { locationId: row.locationId, creationId: row.creationId } },
      });
    const before = await existing();
    if (before) return { row: fromDb(before), created: false };
    try {
      const created = await this.prisma.db.$transaction(async (tx) => {
        const c = await tx.contentDraft.create({
          data: {
            locationId: row.locationId,
            creationId: row.creationId,
            channel: row.channel,
            topic: row.topic,
            title: row.title,
            body: row.body,
            hashtags: row.hashtags,
            cta: row.cta,
            origin: row.origin,
            plannedOn: asDate(row.plannedOn),
            createdById: row.createdById,
          },
        });
        await this.audit(tx, c.id, 'content.draft.created', { channel: row.channel, origin: row.origin, plannedOn: row.plannedOn });
        return c;
      });
      return { row: fromDb(created), created: true };
    } catch (e) {
      if (isUnique(e)) {
        const again = await existing();
        if (again) return { row: fromDb(again), created: false };
      }
      throw e;
    }
  }

  async update(locationId: string, id: string, expectedRevision: number, patch: ContentDraftPatch) {
    return this.prisma.db.$transaction(async (tx) => {
      const data: Record<string, unknown> = { ...patch, updatedAt: new Date(), revision: { increment: 1 } };
      if ('plannedOn' in patch) data.plannedOn = asDate(patch.plannedOn);
      if ('publishedAt' in patch) data.publishedAt = patch.publishedAt ? new Date(patch.publishedAt) : null;
      const done = await tx.contentDraft.updateMany({
        where: { id, locationId, revision: expectedRevision, status: { not: 'ARCHIVED' } },
        data,
      });
      if (done.count !== 1) return null;
      const action =
        patch.status === 'ARCHIVED'
          ? 'content.draft.archived'
          : patch.status === 'PUBLISHED'
            ? 'content.draft.published'
            : 'content.draft.updated';
      await this.audit(tx, id, action, { revision: expectedRevision + 1 });
      const r = await tx.contentDraft.findFirstOrThrow({ where: { id, locationId } });
      return fromDb(r);
    });
  }
}

@Injectable()
export class PrismaContentContext implements ContentContextReader {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async current(): Promise<ContentContext> {
    const organizationId = currentOrganizationId();
    if (!hasSignedInActor() || !organizationId) throw new ForbiddenException('Войдите в организацию');
    const locationId = currentLocationId();
    if (!locationId) throw new ConflictException('Выберите филиал');
    const location = await this.prisma.db.location.findFirst({
      where: { id: locationId, status: 'ACTIVE', business: { organizationId, status: 'ACTIVE' } },
      select: {
        id: true,
        name: true,
        timezone: true,
        businessId: true,
        business: { select: { vertical: true } },
        marketingSite: { select: { slug: true, state: true, domains: { select: { host: true, status: true, isPrimary: true } } } },
      },
    });
    if (!location) throw new ForbiddenException('Выбранный филиал недоступен: выберите филиал заново');
    const snapshot = await this.prisma.db.$transaction((tx) =>
      readSiteFactsSnapshot(tx, {
        organizationId,
        businessId: location.businessId,
        locationId: location.id,
        vertical: location.business.vertical as SiteFactsVertical,
      }),
    );
    const facts = buildSiteFacts(snapshot);
    const site = location.marketingSite;
    let siteUrl: string | null = null;
    if (site?.state === 'PUBLISHED') {
      const primary = site.domains.find((d) => d.isPrimary && d.status === 'ACTIVE');
      const base = parseSitesBaseDomain(process.env.SITES_BASE_DOMAIN);
      siteUrl = primary ? `https://${primary.host}` : base.ok ? `https://${platformHost(site.slug, base.domain)}` : null;
    }
    return {
      organizationId,
      locationId: location.id,
      userId: currentUserId() ?? null,
      timezone: location.timezone,
      vertical: location.business.vertical,
      name: location.name,
      city: facts.location.city,
      facts: contentFactsOf(facts),
      contacts: { siteUrl, phone: facts.location.phone, whatsapp: facts.location.whatsapp, address: facts.location.address },
    };
  }

  async assertWritable(organizationId: string) {
    const org = await this.prisma.db.organization.findUnique({
      where: { id: organizationId },
      select: { status: true, trialEndsAt: true },
    });
    if (!org || !canWrite(org.status, org.trialEndsAt, new Date()))
      throw new ForbiddenException('Организация доступна только для чтения');
  }
}

/** Раздел «Маркетинг» (ADR-MKT-B7): черновики постов филиала; ничего не публикует в соцсети */
@Access('marketing')
@Controller('marketing/content/drafts')
export class ContentDraftsController {
  constructor(@Inject(ContentDraftsService) private readonly drafts: ContentDraftsService) {}

  @Post('proposal')
  @HttpCode(200)
  propose(@Body() body: unknown) {
    return this.drafts.propose(body);
  }

  @Get()
  week(@Query('week') week?: string) {
    return this.drafts.week(week);
  }

  @Post()
  create(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    return this.drafts.create(body, res);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.drafts.update(id, body);
  }

  @Post(':id/published')
  @HttpCode(200)
  published(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.drafts.published(id, body);
  }

  @Post(':id/archive')
  @HttpCode(200)
  archive(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.drafts.archive(id, body);
  }
}
