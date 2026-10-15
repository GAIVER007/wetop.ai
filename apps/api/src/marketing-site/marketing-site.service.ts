import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  BOOKMARKS_PER_SITE,
  bootstrapSlug,
  diffSiteSpecs,
  parseBookmarkLabel,
  parseBuilderInstructions,
  siteSpecHash,
  validateSiteSpec,
} from '@pms/domain';
import type { DbTx, Prisma } from '@pms/database';
import { currentUserId } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { publicationView } from './publication.service';
import { assetUnavailable, checkSpecAssets } from './asset-refs';
import { siteBuilderAccessIn, siteScope, siteTransaction, type SiteScope } from './scope';

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** История версий в ответе: до 100 последних (MKT9 §47), документа в списке нет */
export const VERSION_LIST_LIMIT = 100;
export const VERSION_CONFLICT = {
  code: 'VERSION_CONFLICT',
  message: 'Сайт уже изменён в другой вкладке или ИИ: обновите черновик и повторите',
};

const VERSION_ROW = {
  id: true,
  revision: true,
  parentVersionId: true,
  source: true,
  generationRunId: true,
  createdById: true,
  createdAt: true,
  specHash: true,
} as const;

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

  /**
   * Сайт филиала и состояние конструктора (MKT9.2): лицензия филиала, знания проекта, имя филиала для полосы проекта и
   * признак архива (архивный сайт не заводится заново: один филиал, один сайт навсегда)
   */
  async current(pointerSent: boolean) {
    const scope = siteScope(pointerSent);
    return siteTransaction(this.prisma, scope, false, async (tx) => {
      const [site, any, location, builder] = await Promise.all([
        this.activeSite(tx, scope),
        tx.marketingSite.findUnique({ where: { locationId: scope.locationId }, select: { state: true, builderInstructions: true } }),
        tx.location.findUnique({ where: { id: scope.locationId }, select: { name: true } }),
        siteBuilderAccessIn(tx, scope.locationId),
      ]);
      return {
        site: site ? siteView(site) : null,
        archived: any?.state === 'ARCHIVED',
        locationName: location?.name ?? null,
        builder: { access: builder.access, status: builder.status, activeUntil: builder.activeUntil?.toISOString() ?? null },
        instructions: any?.builderInstructions ?? null,
      };
    });
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

  /**
   * Заведение сайта филиала (MKT9.2, bootstrap): тело пустое, имя из филиала, адрес из имени с детерминированным
   * суффиксом при занятости. Сайт уже есть: тот же сайт (200); архивный: 409 `SITE_ARCHIVED`, второго не будет.
   * Прежний путь с названием и адресом из браузера снят: ни название, ни адрес человек здесь не выбирает
   */
  async bootstrap(pointerSent: boolean, body: unknown) {
    const scope = siteScope(pointerSent);
    strictBody(body ?? {}, []);
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await siteTransaction(this.prisma, scope, true, async (tx) => {
          const existing = await tx.marketingSite.findUnique({ where: { locationId: scope.locationId }, select: { state: true } });
          if (existing?.state === 'ARCHIVED')
            throw new ConflictException({ code: 'SITE_ARCHIVED', message: 'Сайт филиала в архиве: новый сайт для этого филиала не заводится' });
          const found = existing ? await this.activeSite(tx, scope) : null;
          if (found) return { created: false, site: siteView(found) };
          const location = await tx.location.findUniqueOrThrow({ where: { id: scope.locationId }, select: { name: true } });
          const name = [...location.name.trim()].slice(0, 120).join('') || 'Сайт';
          const base = bootstrapSlug(name, new Set());
          const taken = await tx.marketingSite.findMany({
            where: { slug: { startsWith: base.slice(0, 30) }, state: { not: 'ARCHIVED' } },
            select: { slug: true },
          });
          const slug = bootstrapSlug(name, new Set(taken.map((t) => t.slug)));
          const site = await tx.marketingSite.create({
            data: { locationId: scope.locationId, name, slug, createdById: currentUserId() },
            select: SITE_SELECT,
          });
          await this.audit(tx, scope, site.id, 'marketing.site.created', { siteId: site.id, slug: site.slug, via: 'bootstrap' });
          return { created: true, site: siteView(site) };
        });
      } catch (error) {
        // соседний филиал занял тот же адрес между выбором и вставкой: ещё один круг с новым списком занятых
        if (isUniqueViolation(error) && attempt < 2) continue;
        throw error;
      }
    }
  }

  /** Знания проекта (MKT9.2): постоянные указания ИИ этого сайта; это данные для модели, а не правила системы */
  async context(pointerSent: boolean) {
    const scope = siteScope(pointerSent);
    return siteTransaction(this.prisma, scope, false, async (tx) => {
      const site = await tx.marketingSite.findFirst({
        where: { locationId: scope.locationId, state: { not: 'ARCHIVED' } },
        select: { builderInstructions: true },
      });
      if (!site) throw new NotFoundException('Сайт филиала ещё не создан');
      return { instructions: site.builderInstructions };
    });
  }

  async updateContext(pointerSent: boolean, body: unknown) {
    const scope = siteScope(pointerSent);
    const input = strictBody(body, ['instructions']);
    if (!('instructions' in input)) throw new BadRequestException('instructions: строка или null');
    const parsed = parseBuilderInstructions(input['instructions']);
    if (!parsed.ok) throw new BadRequestException(parsed.message);
    return siteTransaction(this.prisma, scope, true, async (tx) => {
      const site = await this.activeSite(tx, scope);
      if (!site) throw new NotFoundException('Сайт филиала ещё не создан');
      await tx.marketingSite.update({ where: { id: site.id }, data: { builderInstructions: parsed.value } });
      // в журнале только длина: указания пишет человек, это его текст
      await this.audit(tx, scope, site.id, 'marketing.site.context_updated', { siteId: site.id, length: [...(parsed.value ?? '')].length });
      return { instructions: parsed.value };
    });
  }

  /** Закладка версии (MKT9.2): поставить или переименовать; до 20 на сайт; чужая версия неотличима от несуществующей */
  async bookmark(pointerSent: boolean, id: string, body: unknown) {
    const scope = siteScope(pointerSent);
    const input = strictBody(body, ['label']);
    const label = parseBookmarkLabel(input['label']);
    if (!label.ok) throw new BadRequestException(label.message);
    return siteTransaction(this.prisma, scope, true, async (tx) => {
      const { site, version } = await this.ownVersion(tx, scope, id);
      const current = await tx.marketingSiteVersionBookmark.findUnique({ where: { siteId_versionId: { siteId: site.id, versionId: version.id } } });
      if (!current && (await tx.marketingSiteVersionBookmark.count({ where: { siteId: site.id } })) >= BOOKMARKS_PER_SITE)
        throw new ConflictException({ code: 'BOOKMARK_LIMIT', message: `Не больше ${BOOKMARKS_PER_SITE} закладок: снимите ненужную` });
      const saved = current
        ? await tx.marketingSiteVersionBookmark.update({ where: { id: current.id }, data: { label: label.value! }, select: { label: true, createdAt: true } })
        : await tx.marketingSiteVersionBookmark.create({
            data: { id: randomUUID(), siteId: site.id, versionId: version.id, label: label.value!, createdById: currentUserId() },
            select: { label: true, createdAt: true },
          });
      await this.audit(tx, scope, site.id, current ? 'marketing.site.bookmark_renamed' : 'marketing.site.bookmark_added', {
        siteId: site.id,
        versionId: version.id,
        revision: version.revision,
      });
      return { bookmark: { versionId: version.id, revision: version.revision, ...saved } };
    });
  }

  async removeBookmark(pointerSent: boolean, id: string) {
    const scope = siteScope(pointerSent);
    return siteTransaction(this.prisma, scope, true, async (tx) => {
      const { site, version } = await this.ownVersion(tx, scope, id);
      const gone = await tx.marketingSiteVersionBookmark.deleteMany({ where: { siteId: site.id, versionId: version.id } });
      if (gone.count === 0) throw new NotFoundException('Закладки нет');
      await this.audit(tx, scope, site.id, 'marketing.site.bookmark_removed', { siteId: site.id, versionId: version.id, revision: version.revision });
      return { removed: true };
    });
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
        if ((latest?.revision ?? 0) !== baseRevision) throw new ConflictException(VERSION_CONFLICT);
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
        return { version: { id: version.id, ...versionMeta(version) } };
      });
    } catch (error) {
      // запасной замок: уникальность (site_id, revision) в базе
      if (isUniqueViolation(error)) throw new ConflictException(VERSION_CONFLICT);
      throw error;
    }
  }

  /**
   * История версий сайта филиала (MKT9 §46–§47): до 100 последних, только метаданные. Голова и опубликованная
   * отмечены; документа нет, его читает `version(id)`
   */
  async versions(pointerSent: boolean) {
    const scope = siteScope(pointerSent);
    return siteTransaction(this.prisma, scope, false, async (tx) => {
      const site = await this.activeSite(tx, scope);
      if (!site) throw new NotFoundException('Сайт филиала ещё не создан');
      const rows = await tx.marketingSiteVersion.findMany({
        where: { siteId: site.id },
        orderBy: { revision: 'desc' },
        take: VERSION_LIST_LIMIT,
        select: VERSION_ROW,
      });
      // MKT9.2: закладки целиком (их до 20), даже если версия старше сотни последних
      const marks = await tx.marketingSiteVersionBookmark.findMany({
        where: { siteId: site.id },
        orderBy: { createdAt: 'desc' },
        select: { versionId: true, label: true, createdAt: true, version: { select: VERSION_ROW } },
      });
      const label = new Map(marks.map((m) => [m.versionId, m.label]));
      const view = (v: (typeof rows)[number]) => ({
        ...v,
        isLatest: v.id === site.latestVersion?.id,
        isPublished: v.id === site.publishedVersion?.id,
        bookmark: label.get(v.id) ?? null,
      });
      return {
        versions: rows.map(view),
        bookmarks: marks.map((m) => ({ ...view(m.version), bookmarkedAt: m.createdAt })),
      };
    });
  }

  /** Версия этого сайта по id с документом; версия чужого сайта или филиала неотличима от несуществующей (404) */
  async version(pointerSent: boolean, id: string) {
    const scope = siteScope(pointerSent);
    return siteTransaction(this.prisma, scope, false, async (tx) => {
      const { site, version } = await this.ownVersion(tx, scope, id);
      return {
        version: {
          ...version,
          isLatest: version.id === site.latestVersion?.id,
          isPublished: version.id === site.publishedVersion?.id,
        },
      };
    });
  }

  /** Смысловая разница `against → id` (MKT9 §56): обе версии этого сайта, иначе 404 */
  async diff(pointerSent: boolean, id: string, against: unknown) {
    const scope = siteScope(pointerSent);
    if (typeof against !== 'string') throw new BadRequestException('against: id версии');
    return siteTransaction(this.prisma, scope, false, async (tx) => {
      const to = await this.ownVersion(tx, scope, id);
      const from = await this.ownVersion(tx, scope, against);
      const meta = (v: typeof to.version) => {
        const rest: Partial<typeof v> = { ...v };
        delete rest.spec;
        return rest;
      };
      return { from: meta(from.version), to: meta(to.version), changes: diffSiteSpecs(from.version.spec, to.version.spec) };
    });
  }

  /**
   * Восстановление старой версии как НОВОГО черновика (MKT9 §58–§60), не путать с публичным откатом MKT7: голова
   * получает новую версию `revision + 1` с документом старой, родитель прежняя голова, источник `MANUAL`;
   * опубликованная версия не меняется. Картинки по правилам черновика: удалённая из библиотеки даёт 409
   * `ASSET_UNAVAILABLE`, её надо заменить (публичный откат её по-прежнему покажет)
   */
  async restore(pointerSent: boolean, id: string, body: unknown) {
    const scope = siteScope(pointerSent);
    const input = strictBody(body, ['baseRevision']);
    const baseRevision = input['baseRevision'];
    if (typeof baseRevision !== 'number' || !Number.isInteger(baseRevision) || baseRevision < 0)
      throw new BadRequestException('baseRevision: целое число от 0');
    try {
      return await siteTransaction(this.prisma, scope, true, async (tx) => {
        const found = await this.activeSite(tx, scope);
        if (!found) throw new NotFoundException('Сайт филиала ещё не создан');
        await tx.$queryRaw`SELECT id FROM marketing_sites WHERE id=${found.id}::uuid FOR UPDATE`;
        const { site, version: source } = await this.ownVersion(tx, scope, id);
        const latest = site.latestVersion ?? null;
        if ((latest?.revision ?? 0) !== baseRevision) throw new ConflictException(VERSION_CONFLICT);
        const checked = validateSiteSpec(source.spec);
        if (!checked.ok)
          throw new BadRequestException({ message: 'Документ версии не проходит текущую проверку', errors: checked.errors });
        const assets = await checkSpecAssets(tx, scope.locationId, checked.spec, { historical: false, lock: true });
        if (assets.problems.length) throw assetUnavailable(assets.problems);
        const version = await tx.marketingSiteVersion.create({
          data: {
            id: randomUUID(),
            siteId: site.id,
            revision: baseRevision + 1,
            parentVersionId: latest?.id ?? null,
            schemaVersion: checked.schemaVersion,
            spec: checked.spec as Prisma.InputJsonObject,
            specHash: siteSpecHash(checked.spec),
            source: 'MANUAL',
            createdById: currentUserId(),
          },
          select: { id: true, revision: true, specHash: true, schemaVersion: true, source: true, createdAt: true },
        });
        await tx.marketingSite.update({ where: { id: site.id }, data: { latestVersionId: version.id } });
        await this.audit(tx, scope, site.id, 'marketing.site.version_restored', {
          siteId: site.id,
          revision: version.revision,
          restoredFromVersionId: source.id,
          restoredFromRevision: source.revision,
          specHash: version.specHash,
        });
        return { version: { id: version.id, ...versionMeta(version) }, restoredFrom: { id: source.id, revision: source.revision } };
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException(VERSION_CONFLICT);
      throw error;
    }
  }

  /** Версия сайта этого филиала (не архивного) по id; иначе 404 без различения «чужая» и «нет» */
  private async ownVersion(tx: DbTx, scope: SiteScope, id: string) {
    const site = await this.activeSite(tx, scope);
    if (!site || !UUID_RE.test(id)) throw new NotFoundException('Версия не найдена');
    const version = await tx.marketingSiteVersion.findFirst({
      where: { id, siteId: site.id },
      select: { ...VERSION_ROW, schemaVersion: true, spec: true },
    });
    if (!version) throw new NotFoundException('Версия не найдена');
    return { site, version };
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
