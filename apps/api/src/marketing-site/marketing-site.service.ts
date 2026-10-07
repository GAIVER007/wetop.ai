import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { parseMarketingSlug, siteSpecHash, validateSiteSpec } from '@pms/domain';
import type { DbTx, Prisma } from '@pms/database';
import { currentUserId } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { publicationView } from './publication.service';
import { assetUnavailable, checkSpecAssets } from './asset-refs';
import { siteScope, siteTransaction, type SiteScope } from './scope';

/**
 * Ядро управляемого сайта (MKT3, `DATA_MODEL.md` §29.2–§29.3). Сайт филиала и его неизменяемые версии `SiteSpec`:
 * правка не меняет версию, а дописывает следующую по ревизии; устаревшая ревизия даёт 409, а не перезапись чужой
 * правки. Публикации, превью, доменов и генерации здесь нет (MKT6, MKT7); картинки документа проверяются по библиотеке
 * филиала (MKT8, `asset-refs.ts`).
 */
const SITE_SELECT = {
  id: true,
  name: true,
  slug: true,
  state: true,
  createdAt: true,
  updatedAt: true,
  latestVersion: {
    select: { id: true, revision: true, specHash: true, schemaVersion: true, source: true, createdAt: true },
  },
  // MKT7: опубликованная ревизия и живой домен для страницы публикации (документа в ответе нет)
  publishedVersion: { select: { id: true, revision: true } },
  domains: { where: { status: { not: 'REMOVED' } }, select: { host: true, status: true, isPrimary: true } },
} as const;

type SiteRow = Prisma.MarketingSiteGetPayload<{ select: typeof SITE_SELECT }>;

function siteView(site: SiteRow) {
  const { latestVersion, publishedVersion, domains, ...rest } = site;
  const publication = publicationView({ ...site, latestVersion: latestVersion ?? null, publishedVersion: publishedVersion ?? null, domains });
  return {
    ...rest,
    latest: latestVersion ? { id: latestVersion.id, ...versionMeta(latestVersion) } : null,
    published: publication.published,
    url: publication.url,
    proposedUrl: publication.proposedUrl,
  };
}

function versionMeta(v: NonNullable<SiteRow['latestVersion']>) {
  return {
    revision: v.revision,
    specHash: v.specHash,
    schemaVersion: v.schemaVersion,
    source: v.source,
    createdAt: v.createdAt,
  };
}

/** Тело только со своими полями: филиал, бизнес и организация приходят из scope, лишнее поле это отказ */
function strictBody(body: unknown, allowed: string[]): Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body))
    throw new BadRequestException('Ожидается объект');
  const extra = Object.keys(body).filter((key) => !allowed.includes(key));
  if (extra.length) throw new BadRequestException(`Лишние поля: ${extra.join(', ')}`);
  return body as Record<string, unknown>;
}

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && error.code === 'P2002';
}

@Injectable()
export class MarketingSiteService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private activeSite(tx: DbTx, scope: SiteScope) {
    return tx.marketingSite.findFirst({
      where: { locationId: scope.locationId, state: { not: 'ARCHIVED' } },
      select: SITE_SELECT,
    });
  }

  async current(pointerSent: boolean) {
    const scope = siteScope(pointerSent);
    const site = await siteTransaction(this.prisma, scope, false, (tx) => this.activeSite(tx, scope));
    return { site: site ? siteView(site) : null };
  }

  async draft(pointerSent: boolean) {
    const scope = siteScope(pointerSent);
    return siteTransaction(this.prisma, scope, false, async (tx) => {
      const site = await this.activeSite(tx, scope);
      if (!site) throw new NotFoundException('Сайт филиала ещё не создан');
      const version = site.latestVersion
        ? await tx.marketingSiteVersion.findUniqueOrThrow({
            where: { id: site.latestVersion.id },
            select: { spec: true },
          })
        : null;
      return {
        site: siteView(site),
        version: site.latestVersion ? { ...versionMeta(site.latestVersion), spec: version!.spec } : null,
      };
    });
  }

  async create(pointerSent: boolean, body: unknown) {
    const scope = siteScope(pointerSent);
    const input = strictBody(body, ['name', 'slug']);
    const name = typeof input['name'] === 'string' ? input['name'].trim() : '';
    if (!name || [...name].length > 120)
      throw new BadRequestException('Название сайта: от 1 до 120 знаков');
    const slug = parseMarketingSlug(input['slug']);
    if (!slug.ok) throw new BadRequestException(slug.message);
    try {
      return await siteTransaction(this.prisma, scope, true, async (tx) => {
        if (await this.activeSite(tx, scope))
          throw new ConflictException('У филиала уже есть сайт');
        const taken = await tx.marketingSite.findFirst({
          where: { slug: slug.slug, state: { not: 'ARCHIVED' } },
          select: { id: true },
        });
        if (taken) throw new ConflictException(`Адрес «${slug.slug}» уже занят: выберите другой`);
        const site = await tx.marketingSite.create({
          data: { locationId: scope.locationId, name, slug: slug.slug, createdById: currentUserId() },
          select: SITE_SELECT,
        });
        await this.audit(tx, scope, site.id, 'marketing.site.created', { siteId: site.id, slug: site.slug });
        return { site: siteView(site) };
      });
    } catch (error) {
      // другой филиал успел занять адрес между проверкой и вставкой: частичный уникальный индекс
      if (isUniqueViolation(error)) throw new ConflictException('Адрес уже занят или у филиала уже есть сайт');
      throw error;
    }
  }

  async saveVersion(pointerSent: boolean, body: unknown) {
    const scope = siteScope(pointerSent);
    const input = strictBody(body, ['baseRevision', 'spec']);
    const baseRevision = input['baseRevision'];
    if (typeof baseRevision !== 'number' || !Number.isInteger(baseRevision) || baseRevision < 0)
      throw new BadRequestException('baseRevision: целое число от 0');
    const checked = validateSiteSpec(input['spec']);
    if (!checked.ok)
      throw new BadRequestException({ message: 'Документ сайта не прошёл проверку', errors: checked.errors });
    const specHash = siteSpecHash(checked.spec);
    try {
      return await siteTransaction(this.prisma, scope, true, async (tx) => {
        const found = await this.activeSite(tx, scope);
        if (!found) throw new NotFoundException('Сайт филиала ещё не создан');
        // строка сайта под замком: вторая вкладка с той же ревизией ждёт здесь и увидит уже новую голову
        await tx.$queryRaw`SELECT id FROM marketing_sites WHERE id=${found.id}::uuid FOR UPDATE`;
        const site = await this.activeSite(tx, scope);
        const latest = site?.latestVersion ?? null;
        if ((latest?.revision ?? 0) !== baseRevision)
          throw new ConflictException('Сайт уже изменён в другой вкладке: обновите черновик и повторите');
        // MKT8: каждая картинка документа это готовый ассет этого филиала нужного вида; чужой и несуществующий неотличимы
        const assets = await checkSpecAssets(tx, scope.locationId, checked.spec, { historical: false, lock: true });
        if (assets.problems.length) throw assetUnavailable(assets.problems);
        const version = await tx.marketingSiteVersion.create({
          data: {
            id: randomUUID(),
            siteId: found.id,
            revision: baseRevision + 1,
            parentVersionId: latest?.id ?? null,
            schemaVersion: checked.schemaVersion,
            spec: checked.spec as Prisma.InputJsonObject,
            specHash,
            source: 'MANUAL',
            createdById: currentUserId(),
          },
          select: { id: true, revision: true, specHash: true, schemaVersion: true, source: true, createdAt: true },
        });
        await tx.marketingSite.update({ where: { id: found.id }, data: { latestVersionId: version.id } });
        await this.audit(tx, scope, found.id, 'marketing.site.version_saved', {
          siteId: found.id,
          revision: version.revision,
          specHash,
          schemaVersion: version.schemaVersion,
        });
        return { version: versionMeta(version) };
      });
    } catch (error) {
      // запасной замок: уникальность (site_id, revision) в базе
      if (isUniqueViolation(error))
        throw new ConflictException('Сайт уже изменён в другой вкладке: обновите черновик и повторите');
      throw error;
    }
  }

  /** Журнал без документа: только кто, что и какая версия (поручение владельца MKT3 §12) */
  private async audit(tx: DbTx, scope: SiteScope, siteId: string, action: string, after: Prisma.InputJsonObject) {
    await tx.auditLog.create({
      data: {
        organizationId: scope.organizationId,
        userId: currentUserId(),
        entityType: 'marketing_site',
        entityId: siteId,
        action,
        after,
      },
    });
  }
}
