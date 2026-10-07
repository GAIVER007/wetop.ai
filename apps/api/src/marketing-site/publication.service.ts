import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  normalizeSiteHost,
  parseSitesBaseDomain,
  platformHost,
  previewHost,
  SITE_SPEC_SCHEMA_VERSION,
  siteSpecCategoryCodes,
  siteSpecHash,
  siteSpecMediaPaths,
  validateSiteSpec,
} from '@pms/domain';
import type { DbTx, Prisma } from '@pms/database';
import { currentUserId } from '../auth/request-context';
import { newSiteKey } from '../analytics/analytics.service';
import { PrismaService } from '../database/prisma.provider';
import { PREVIEW_TTL_SECONDS, previewSecretFromEnv, signPreviewToken } from './preview-token';
import { siteScope, siteTransaction, type SiteScope } from './scope';

/**
 * Публикация управляемого сайта (MKT7, `docs/marketing/site-publication-v0.md`): превью, публикация, пауза,
 * возобновление, откат, архив, журнал и канонический сайт брони филиала (Q-275). Всё под строгим scope MKT3 и в одной
 * транзакции с замком филиала и строки сайта: две вкладки не опубликуют дважды и не заведут два домена.
 *
 * Хост браузер не передаёт: адрес сайта `<slug>.<SITES_BASE_DOMAIN>` строит сервер (Q-271). Тариф брони не угадывается:
 * явный из запроса, связанного управляемого сайта или канонического сайта брони филиала, иначе 409.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type BookingMode = 'NONE' | 'WETOP_WIDGET';

const SITE_SELECT = {
  id: true,
  name: true,
  slug: true,
  state: true,
  latestVersionId: true,
  publishedVersionId: true,
  trackedSiteId: true,
} as const;
type SiteRow = Prisma.MarketingSiteGetPayload<{ select: typeof SITE_SELECT }>;

function conflict(code: string, message: string, extra: Record<string, unknown> = {}): ConflictException {
  return new ConflictException({ code, message, ...extra });
}

function strictBody(body: unknown, allowed: string[]): Record<string, unknown> {
  if (body === undefined || body === null) return {};
  if (typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('Ожидается объект');
  const extra = Object.keys(body).filter((key) => !allowed.includes(key));
  if (extra.length) throw new BadRequestException(`Лишние поля: ${extra.join(', ')}`);
  return body as Record<string, unknown>;
}

function uuidField(value: unknown, name: string): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) throw new BadRequestException(`${name}: ожидается UUID`);
  return value.toLowerCase();
}

/** Базовый домен сайтов (Q-271): не задан или под wetop.ai, значит публикация и превью закрыты, а не «как-нибудь» */
export function sitesBaseDomain(env: NodeJS.ProcessEnv = process.env): string {
  const parsed = parseSitesBaseDomain(env.SITES_BASE_DOMAIN);
  if (!parsed.ok)
    throw new ServiceUnavailableException({ code: 'SITES_DOMAIN_UNCONFIGURED', message: 'Адрес сайтов не настроен' });
  return parsed.domain;
}

@Injectable()
export class SitePublicationService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // ---------- превью ----------

  /** Подписанная ссылка на 60 минут на одну версию своего сайта; токен не показывается как текст и не хранится */
  async preview(pointerSent: boolean, body: unknown) {
    const scope = siteScope(pointerSent);
    const input = strictBody(body, ['versionId']);
    const versionId = uuidField(input['versionId'], 'versionId');
    const base = sitesBaseDomain();
    const secret = previewSecretFromEnv();
    if (!secret) throw new ServiceUnavailableException({ code: 'PREVIEW_DISABLED', message: 'Предпросмотр недоступен' });
    const found = await siteTransaction(this.prisma, scope, false, async (tx) => {
      const site = await this.activeSite(tx, scope);
      if (!site) throw new NotFoundException('Версия не найдена');
      return tx.marketingSiteVersion.findFirst({ where: { id: versionId, siteId: site.id }, select: { id: true, siteId: true } });
    });
    if (!found) throw new NotFoundException('Версия не найдена');
    const exp = Math.floor(Date.now() / 1000) + PREVIEW_TTL_SECONDS;
    const token = signPreviewToken({ siteId: found.siteId, versionId: found.id, exp }, secret);
    return { url: `https://${previewHost(base)}/?token=${token}`, expiresAt: new Date(exp * 1000).toISOString() };
  }

  // ---------- публикация ----------

  async publish(pointerSent: boolean, body: unknown) {
    const scope = siteScope(pointerSent);
    const input = strictBody(body, ['expectedVersionId', 'bookingRatePlanId']);
    const expected = uuidField(input['expectedVersionId'], 'expectedVersionId');
    const explicitPlan =
      input['bookingRatePlanId'] === undefined ? undefined : uuidField(input['bookingRatePlanId'], 'bookingRatePlanId');
    const base = sitesBaseDomain();
    return siteTransaction(this.prisma, scope, true, async (tx) => {
      const site = await this.lockedSite(tx, scope);
      if (site.latestVersionId !== expected)
        throw conflict('VERSION_CHANGED', 'Опубликовать можно только последнюю версию: обновите страницу');
      // повтор: уже опубликовано (на паузе остаётся на паузе, возобновление отдельным действием)
      if (site.publishedVersionId === expected && site.state !== 'DRAFT')
        return { site: await this.view(tx, site.id), changed: false };
      const propertyId = await this.propertyOf(tx, scope);
      const checked = await this.checkVersion(tx, site.id, expected, propertyId);
      if (checked.mode !== 'WETOP_WIDGET' && explicitPlan !== undefined)
        throw new BadRequestException('bookingRatePlanId: только при бронировании WETOP на сайте');
      const location = await tx.location.findUniqueOrThrow({
        where: { id: scope.locationId },
        select: { bookingTrackedSiteId: true },
      });
      const managed = site.trackedSiteId
        ? await tx.trackedSite.findUnique({ where: { id: site.trackedSiteId }, select: { id: true, bookingRatePlanId: true } })
        : null;
      const plan =
        checked.mode === 'WETOP_WIDGET'
          ? await this.ratePlan(tx, propertyId, explicitPlan, managed?.bookingRatePlanId ?? null, location.bookingTrackedSiteId)
          : null;
      const domain = await this.ensurePlatformDomain(tx, site, base);
      const nextState = site.state === 'PAUSED' ? 'PAUSED' : 'PUBLISHED';
      let trackedSiteId = managed?.id ?? null;
      let canonicalChanged = false;
      if (!trackedSiteId) {
        trackedSiteId = await this.createTrackedSite(tx, site, propertyId, nextState, checked.mode, plan);
        // §31: канонического нет и других подходящих сайтов объекта нет, значит этот сайт брони становится каноническим
        if (location.bookingTrackedSiteId === null && checked.mode === 'WETOP_WIDGET') {
          const others = await tx.trackedSite.count({
            where: { propertyId, id: { not: trackedSiteId }, status: 'ACTIVE', bookingEnabled: true, bookingRatePlanId: { not: null } },
          });
          if (others === 0) {
            await tx.location.update({ where: { id: scope.locationId }, data: { bookingTrackedSiteId: trackedSiteId } });
            canonicalChanged = true;
          }
        }
      } else {
        await tx.trackedSite.update({
          where: { id: trackedSiteId },
          data: {
            status: nextState === 'PUBLISHED' ? 'ACTIVE' : 'PAUSED',
            bookingEnabled: checked.mode === 'WETOP_WIDGET',
            ...(plan ? { bookingRatePlanId: plan } : {}),
          },
        });
      }
      await this.syncHosts(tx, site.id, trackedSiteId);
      await tx.marketingSite.update({
        where: { id: site.id },
        data: { publishedVersionId: expected, state: nextState, trackedSiteId },
      });
      await this.record(tx, scope, site.id, 'PUBLISH', expected, site.publishedVersionId, {
        host: domain,
        trackedSiteId,
        canonicalBookingChanged: canonicalChanged,
      });
      return { site: await this.view(tx, site.id), changed: true };
    });
  }

  async pause(pointerSent: boolean, body: unknown) {
    const scope = siteScope(pointerSent);
    strictBody(body, []);
    return siteTransaction(this.prisma, scope, true, async (tx) => {
      const site = await this.lockedSite(tx, scope);
      if (site.state !== 'PUBLISHED') throw conflict('NOT_PUBLISHED', 'Приостановить можно только опубликованный сайт');
      if (site.trackedSiteId) await tx.trackedSite.update({ where: { id: site.trackedSiteId }, data: { status: 'PAUSED' } });
      await tx.marketingSite.update({ where: { id: site.id }, data: { state: 'PAUSED' } });
      await this.record(tx, scope, site.id, 'PAUSE', null, site.publishedVersionId, { trackedSiteId: site.trackedSiteId });
      return { site: await this.view(tx, site.id) };
    });
  }

  async resume(pointerSent: boolean, body: unknown) {
    const scope = siteScope(pointerSent);
    strictBody(body, []);
    return siteTransaction(this.prisma, scope, true, async (tx) => {
      const site = await this.lockedSite(tx, scope);
      if (site.state !== 'PAUSED' || !site.publishedVersionId)
        throw conflict('NOT_PAUSED', 'Возобновить можно только приостановленный сайт');
      const propertyId = await this.propertyOf(tx, scope);
      const checked = await this.checkVersion(tx, site.id, site.publishedVersionId, propertyId);
      const domain = await tx.siteDomain.findFirst({ where: { siteId: site.id, status: 'ACTIVE', isPrimary: true }, select: { host: true } });
      if (!domain || !site.trackedSiteId) throw conflict('DOMAIN_MISSING', 'У сайта нет действующего адреса: опубликуйте заново');
      const managed = await tx.trackedSite.findUniqueOrThrow({ where: { id: site.trackedSiteId }, select: { bookingRatePlanId: true } });
      const plan = await this.planForMode(tx, scope, propertyId, checked.mode, managed.bookingRatePlanId);
      await tx.trackedSite.update({
        where: { id: site.trackedSiteId },
        data: { status: 'ACTIVE', bookingEnabled: checked.mode === 'WETOP_WIDGET', ...(plan ? { bookingRatePlanId: plan } : {}) },
      });
      await this.syncHosts(tx, site.id, site.trackedSiteId);
      await tx.marketingSite.update({ where: { id: site.id }, data: { state: 'PUBLISHED' } });
      await this.record(tx, scope, site.id, 'RESUME', site.publishedVersionId, site.publishedVersionId, {
        host: domain.host,
        trackedSiteId: site.trackedSiteId,
      });
      return { site: await this.view(tx, site.id) };
    });
  }

  /**
   * Откат (§56–§59): только версия этого сайта, которая уже была опубликована, и не текущая. Меняется только
   * `published_version_id`: голова черновика остаётся, состояние (в том числе пауза) не меняется
   */
  async rollback(pointerSent: boolean, body: unknown) {
    const scope = siteScope(pointerSent);
    const input = strictBody(body, ['versionId']);
    const target = uuidField(input['versionId'], 'versionId');
    return siteTransaction(this.prisma, scope, true, async (tx) => {
      const site = await this.lockedSite(tx, scope);
      const own = await tx.marketingSiteVersion.findFirst({ where: { id: target, siteId: site.id }, select: { id: true } });
      if (!own) throw new NotFoundException('Версия не найдена');
      if (site.state !== 'PUBLISHED' && site.state !== 'PAUSED')
        throw conflict('NOT_PUBLISHED', 'Откат возможен только у опубликованного сайта');
      if (site.publishedVersionId === target) throw conflict('ALREADY_PUBLISHED', 'Эта версия уже опубликована');
      const evidence = await tx.marketingSitePublication.findFirst({
        where: { siteId: site.id, versionId: target, action: { in: ['PUBLISH', 'ROLLBACK', 'RESUME'] } },
        select: { id: true },
      });
      if (!evidence) throw conflict('NEVER_PUBLISHED', 'Откатить можно только на версию, которая уже была опубликована');
      const propertyId = await this.propertyOf(tx, scope);
      const checked = await this.checkVersion(tx, site.id, target, propertyId);
      if (!site.trackedSiteId) throw conflict('DOMAIN_MISSING', 'У сайта нет сайта счётчика: опубликуйте заново');
      const managed = await tx.trackedSite.findUniqueOrThrow({ where: { id: site.trackedSiteId }, select: { bookingRatePlanId: true } });
      const plan = await this.planForMode(tx, scope, propertyId, checked.mode, managed.bookingRatePlanId);
      await tx.trackedSite.update({
        where: { id: site.trackedSiteId },
        data: { bookingEnabled: checked.mode === 'WETOP_WIDGET', ...(plan ? { bookingRatePlanId: plan } : {}) },
      });
      await tx.marketingSite.update({ where: { id: site.id }, data: { publishedVersionId: target } });
      await this.record(tx, scope, site.id, 'ROLLBACK', target, site.publishedVersionId, { trackedSiteId: site.trackedSiteId });
      return { site: await this.view(tx, site.id) };
    });
  }

  /**
   * Архив (§60–§61): домены сняты, сайт счётчика на паузе и без хостов сайта, указатель брони снят, если стоял на нём
   * (на внешний сайт сам не переключается). Версии и журнал не удаляются
   */
  async archive(pointerSent: boolean, body: unknown) {
    const scope = siteScope(pointerSent);
    strictBody(body, []);
    return siteTransaction(this.prisma, scope, true, async (tx) => {
      const site = await this.lockedSite(tx, scope);
      const now = new Date();
      await tx.siteDomain.updateMany({
        where: { siteId: site.id, status: { in: ['PENDING', 'ACTIVE', 'VERIFIED', 'FAILED'] } },
        data: { status: 'REMOVED', removedAt: now },
      });
      let canonicalChanged = false;
      if (site.trackedSiteId) {
        await tx.trackedSite.update({ where: { id: site.trackedSiteId }, data: { status: 'PAUSED' } });
        await this.syncHosts(tx, site.id, site.trackedSiteId);
        const cleared = await tx.location.updateMany({
          where: { id: scope.locationId, bookingTrackedSiteId: site.trackedSiteId },
          data: { bookingTrackedSiteId: null },
        });
        canonicalChanged = cleared.count > 0;
      }
      await tx.marketingSite.update({ where: { id: site.id }, data: { state: 'ARCHIVED', archivedAt: now } });
      await this.record(tx, scope, site.id, 'ARCHIVE', null, site.publishedVersionId, {
        trackedSiteId: site.trackedSiteId,
        canonicalBookingChanged: canonicalChanged,
      });
      return { site: { id: site.id, state: 'ARCHIVED' as const } };
    });
  }

  /** Журнал без документа: действие, версия и её ревизия, автор, время */
  async publications(pointerSent: boolean) {
    const scope = siteScope(pointerSent);
    return siteTransaction(this.prisma, scope, false, async (tx) => {
      const site = await this.activeSite(tx, scope);
      if (!site) return { publications: [] };
      const rows = await tx.marketingSitePublication.findMany({
        where: { siteId: site.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          action: true,
          versionId: true,
          previousVersionId: true,
          actorId: true,
          createdAt: true,
          version: { select: { revision: true } },
          previousVersion: { select: { revision: true } },
        },
      });
      return {
        publications: rows.map((r) => ({
          id: r.id,
          action: r.action,
          versionId: r.versionId,
          revision: r.version?.revision ?? null,
          previousVersionId: r.previousVersionId,
          previousRevision: r.previousVersion?.revision ?? null,
          actorId: r.actorId,
          createdAt: r.createdAt,
        })),
      };
    });
  }

  // ---------- канонический сайт брони (Q-275) ----------

  async bookingSource(pointerSent: boolean) {
    const scope = siteScope(pointerSent);
    return siteTransaction(this.prisma, scope, false, (tx) => this.bookingSourceView(tx, scope));
  }

  async setBookingSource(pointerSent: boolean, body: unknown) {
    const scope = siteScope(pointerSent);
    const input = strictBody(body, ['trackedSiteId']);
    if (!('trackedSiteId' in input)) throw new BadRequestException('trackedSiteId: UUID или null');
    const next = input['trackedSiteId'] === null ? null : uuidField(input['trackedSiteId'], 'trackedSiteId');
    return siteTransaction(this.prisma, scope, true, async (tx) => {
      const propertyId = await this.propertyOf(tx, scope);
      if (next) {
        const site = await tx.trackedSite.findFirst({
          where: { id: next, propertyId },
          select: { status: true, bookingEnabled: true, bookingRatePlanId: true },
        });
        if (!site) throw new NotFoundException('Сайт не найден');
        if (site.status !== 'ACTIVE' || !site.bookingEnabled || !site.bookingRatePlanId)
          throw conflict('BOOKING_SOURCE_NOT_ELIGIBLE', 'Источником брони может быть только работающий сайт с бронью и тарифом');
      }
      const before = await tx.location.findUniqueOrThrow({ where: { id: scope.locationId }, select: { bookingTrackedSiteId: true } });
      if (before.bookingTrackedSiteId !== next) {
        await tx.location.update({ where: { id: scope.locationId }, data: { bookingTrackedSiteId: next } });
        await tx.auditLog.create({
          data: {
            organizationId: scope.organizationId,
            userId: currentUserId(),
            entityType: 'location',
            entityId: scope.locationId,
            action: 'marketing.site.booking_source.changed',
            before: { trackedSiteId: before.bookingTrackedSiteId },
            after: { trackedSiteId: next },
          },
        });
      }
      return this.bookingSourceView(tx, scope);
    });
  }

  private async bookingSourceView(tx: DbTx, scope: SiteScope) {
    const location = await tx.location.findUniqueOrThrow({ where: { id: scope.locationId }, select: { bookingTrackedSiteId: true } });
    const property = await tx.property.findFirst({ where: { locationId: scope.locationId, organizationId: scope.organizationId }, select: { id: true } });
    const options = property
      ? await tx.trackedSite.findMany({
          where: { propertyId: property.id },
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            status: true,
            bookingEnabled: true,
            bookingRatePlan: { select: { id: true, code: true, name: true } },
            marketingSite: { select: { id: true } },
          },
        })
      : [];
    return {
      canonicalTrackedSiteId: location.bookingTrackedSiteId,
      options: options.map((o) => ({
        id: o.id,
        name: o.name,
        status: o.status,
        bookingEnabled: o.bookingEnabled,
        bookingRatePlan: o.bookingRatePlan,
        managed: o.marketingSite !== null,
      })),
    };
  }

  // ---------- общее ----------

  private activeSite(tx: DbTx, scope: SiteScope) {
    return tx.marketingSite.findFirst({ where: { locationId: scope.locationId, state: { not: 'ARCHIVED' } }, select: SITE_SELECT });
  }

  /** Сайт филиала под замком строки: публикация, пауза, откат и архив одного сайта идут по одному */
  private async lockedSite(tx: DbTx, scope: SiteScope): Promise<SiteRow> {
    const found = await this.activeSite(tx, scope);
    if (!found) throw new NotFoundException('Сайт филиала ещё не создан');
    await tx.$queryRaw`SELECT id FROM marketing_sites WHERE id=${found.id}::uuid FOR UPDATE`;
    const site = await this.activeSite(tx, scope);
    if (!site) throw new NotFoundException('Сайт филиала ещё не создан');
    return site;
  }

  private async propertyOf(tx: DbTx, scope: SiteScope): Promise<string> {
    const property = await tx.property.findFirst({
      where: { locationId: scope.locationId, organizationId: scope.organizationId },
      select: { id: true },
    });
    if (!property) throw conflict('NO_PROPERTY', 'У филиала нет гостиницы в системе');
    return property.id;
  }

  /**
   * Проверка версии перед публикацией, откатом и возобновлением (§45–§47): своя версия, тот же валидатор, версия схемы и
   * хэш, ни одной ссылки на медиа до MKT8, все категории документа есть у объекта филиала и активны
   */
  private async checkVersion(tx: DbTx, siteId: string, versionId: string, propertyId: string): Promise<{ mode: BookingMode }> {
    const version = await tx.marketingSiteVersion.findFirst({
      where: { id: versionId, siteId },
      select: { spec: true, specHash: true, schemaVersion: true },
    });
    if (!version) throw new NotFoundException('Версия не найдена');
    const spec = version.spec as Record<string, unknown>;
    const valid = validateSiteSpec(spec);
    if (!valid.ok || version.schemaVersion !== SITE_SPEC_SCHEMA_VERSION || siteSpecHash(spec) !== version.specHash)
      throw conflict('SPEC_INVALID', 'Документ сайта не прошёл проверку', {
        errors: valid.ok ? [] : valid.errors.slice(0, 20).map((e) => ({ path: e.path, code: e.code })),
      });
    const media = siteSpecMediaPaths(spec);
    if (media.length)
      throw conflict('MEDIA_NOT_READY', 'Фото и логотип станут доступны с загрузкой изображений: уберите их из версии', {
        paths: media.slice(0, 20),
      });
    const codes = siteSpecCategoryCodes(spec);
    if (codes.length) {
      const active = await tx.accommodationType.findMany({
        where: { propertyId, code: { in: codes }, active: true },
        select: { code: true },
      });
      const have = new Set(active.map((c) => c.code));
      const missing = codes.filter((c) => !have.has(c));
      if (missing.length)
        throw conflict('CATEGORY_UNAVAILABLE', 'В версии есть категории, которых в гостинице нет или они выключены', { codes: missing });
    }
    const integrations = (spec['integrations'] ?? {}) as { booking?: { mode?: string } };
    return { mode: integrations.booking?.mode === 'WETOP_WIDGET' ? 'WETOP_WIDGET' : 'NONE' };
  }

  /**
   * Тариф брони (§29): явный из запроса → тариф связанного управляемого сайта → тариф канонического сайта брони
   * филиала → 409. Первый активный, самый дешёвый и «базовый» не берутся. Заданный, но уже недействующий тариф даёт
   * 409, а не переход к следующему источнику
   */
  private async ratePlan(
    tx: DbTx,
    propertyId: string,
    explicit: string | undefined,
    managedPlan: string | null,
    canonicalSiteId: string | null,
  ): Promise<string> {
    const usable = async (id: string) =>
      !!(await tx.ratePlan.findFirst({ where: { id, propertyId, active: true }, select: { id: true } }));
    const pick = async (id: string) => {
      if (!(await usable(id))) throw conflict('BOOKING_RATE_PLAN_INVALID', 'Тариф брони не найден у этой гостиницы или выключен');
      return id;
    };
    if (explicit !== undefined) return pick(explicit);
    if (managedPlan) return pick(managedPlan);
    if (canonicalSiteId) {
      const canonical = await tx.trackedSite.findFirst({
        where: { id: canonicalSiteId, propertyId },
        select: { bookingRatePlanId: true },
      });
      if (canonical?.bookingRatePlanId) return pick(canonical.bookingRatePlanId);
    }
    throw conflict('BOOKING_RATE_PLAN_REQUIRED', 'Выберите тариф, по которому сайт будет принимать брони');
  }

  private async planForMode(tx: DbTx, scope: SiteScope, propertyId: string, mode: BookingMode, managedPlan: string | null) {
    if (mode !== 'WETOP_WIDGET') return null;
    const location = await tx.location.findUniqueOrThrow({ where: { id: scope.locationId }, select: { bookingTrackedSiteId: true } });
    return this.ratePlan(tx, propertyId, undefined, managedPlan, location.bookingTrackedSiteId);
  }

  /** Домен платформы: найти живой или завести `PENDING` и включить. Хост только из slug и базы, занятый 409 */
  private async ensurePlatformDomain(tx: DbTx, site: SiteRow, base: string): Promise<string> {
    let domain = await tx.siteDomain.findFirst({
      where: { siteId: site.id, kind: 'PLATFORM_SUBDOMAIN', status: { not: 'REMOVED' } },
      select: { id: true, host: true, status: true },
    });
    if (!domain) {
      const host = platformHost(site.slug, base);
      if (normalizeSiteHost(host) !== host) throw conflict('HOST_INVALID', 'Адрес сайта не подходит');
      const taken = await tx.siteDomain.findFirst({ where: { host, status: { notIn: ['REMOVED', 'FAILED'] } }, select: { id: true } });
      if (taken) throw conflict('HOST_TAKEN', 'Адрес сайта уже занят');
      domain = await tx.siteDomain.create({
        data: { siteId: site.id, host, kind: 'PLATFORM_SUBDOMAIN', isPrimary: true, status: 'PENDING' },
        select: { id: true, host: true, status: true },
      });
    }
    if (domain.status === 'PENDING')
      await tx.siteDomain.update({ where: { id: domain.id }, data: { status: 'ACTIVE', activatedAt: new Date() } });
    return domain.host;
  }

  /** Новый сайт счётчика управляемого сайта: свой ключ `pms_…`, никогда не чужой внешний */
  private async createTrackedSite(
    tx: DbTx,
    site: SiteRow,
    propertyId: string,
    state: 'PUBLISHED' | 'PAUSED',
    mode: BookingMode,
    plan: string | null,
  ): Promise<string> {
    let publicKey = newSiteKey();
    for (let i = 0; i < 5 && (await tx.trackedSite.findUnique({ where: { publicKey }, select: { id: true } })); i++)
      publicKey = newSiteKey();
    const created = await tx.trackedSite.create({
      data: {
        propertyId,
        name: site.name,
        hosts: [],
        publicKey,
        status: state === 'PUBLISHED' ? 'ACTIVE' : 'PAUSED',
        bookingEnabled: mode === 'WETOP_WIDGET',
        bookingRatePlanId: plan,
      },
      select: { id: true },
    });
    return created.id;
  }

  /** Хосты сайта счётчика: живые домены сайта есть, снятые убраны; чужие хосты сайта счётчика не трогаются */
  private async syncHosts(tx: DbTx, siteId: string, trackedSiteId: string) {
    const domains = await tx.siteDomain.findMany({ where: { siteId }, select: { host: true, status: true } });
    const live = domains.filter((d) => d.status === 'ACTIVE').map((d) => d.host);
    const ours = new Set(domains.map((d) => d.host));
    const ts = await tx.trackedSite.findUniqueOrThrow({ where: { id: trackedSiteId }, select: { hosts: true } });
    const hosts = [...new Set([...ts.hosts.filter((h) => !ours.has(h)), ...live])];
    await tx.trackedSite.update({ where: { id: trackedSiteId }, data: { hosts } });
  }

  private async record(
    tx: DbTx,
    scope: SiteScope,
    siteId: string,
    action: 'PUBLISH' | 'ROLLBACK' | 'PAUSE' | 'RESUME' | 'ARCHIVE',
    versionId: string | null,
    previousVersionId: string | null,
    extra: Record<string, unknown>,
  ) {
    const actorId = currentUserId();
    await tx.marketingSitePublication.create({ data: { siteId, action, versionId, previousVersionId, actorId } });
    await tx.auditLog.create({
      data: {
        organizationId: scope.organizationId,
        userId: actorId,
        entityType: 'marketing_site',
        entityId: siteId,
        action: `marketing.site.${action.toLowerCase()}`,
        after: { siteId, action, versionId, previousVersionId, ...extra } as Prisma.InputJsonObject,
      },
    });
  }

  /** Состояние публикации для стойки: ревизии, адрес и домен; документа нет */
  async view(tx: DbTx, siteId: string) {
    const site = await tx.marketingSite.findUniqueOrThrow({
      where: { id: siteId },
      select: {
        id: true,
        name: true,
        slug: true,
        state: true,
        latestVersion: { select: { id: true, revision: true } },
        publishedVersion: { select: { id: true, revision: true } },
        domains: { where: { status: { not: 'REMOVED' } }, select: { host: true, status: true, isPrimary: true } },
      },
    });
    return publicationView(site);
  }
}

/** Адрес сайта: действующий основной домен; до публикации предлагаемый `https://<slug>.<база>` без домена в базе */
export function publicationView(site: {
  id: string;
  name: string;
  slug: string;
  state: string;
  latestVersion: { id: string; revision: number } | null;
  publishedVersion: { id: string; revision: number } | null;
  domains: Array<{ host: string; status: string; isPrimary: boolean }>;
}) {
  const primary = site.domains.find((d) => d.isPrimary && d.status === 'ACTIVE') ?? null;
  const base = parseSitesBaseDomain(process.env.SITES_BASE_DOMAIN);
  return {
    id: site.id,
    name: site.name,
    slug: site.slug,
    state: site.state,
    latest: site.latestVersion,
    published: site.publishedVersion,
    url: primary ? `https://${primary.host}` : null,
    proposedUrl: base.ok ? `https://${platformHost(site.slug, base.domain)}` : null,
  };
}
