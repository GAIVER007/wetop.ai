import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import {
  parseAssetKind,
  parseDefaultAlt,
  SITE_ASSET_LIMITS,
  siteAssetStorageKey,
  type SiteAssetKind,
} from '@pms/domain';
import { Prisma, type DbTx } from '@pms/database';
import { currentUserId } from '../auth/request-context';
import { readChannexContent, type ContentReader } from '../channels/content';
import { PROVIDER } from '../channels/ari-publisher';
import { PrismaService } from '../database/prisma.provider';
import { RateWindows } from '../rate-window';
import { AssetImageError, processSiteImage, type ProcessedImage } from './asset-image';
import { safeDownload, SafeFetchError, type SafeFetchDeps } from './asset-fetch';
import { assetStorageUnavailable, assetUsedByPublishedHistory } from './asset-refs';
import { SITE_ASSET_STORAGE, signedUrlTtl, type SiteAssetStorage } from './asset-storage';
import { BRIEF_CHANNEX_READER } from './brief.service';
import { siteScope, siteTransaction, type SiteScope } from './scope';

/**
 * Библиотека изображений управляемого сайта (MKT8, `docs/marketing/site-assets-v0.md`). Всё под строгим scope MKT3 и
 * правом `settings`: филиал только из scope, тело его не выбирает.
 *
 * Загрузка синхронная: проверка и обработка в памяти API, запись готовой копии в приватный S3 в Казахстане, затем строка
 * `READY`. Сырой файл не сохраняется нигде. Хранилище не настроено: метаданные читаются, загрузка и импорт 503.
 * Ни ключ объекта, ни адрес бакета, ни подпись в журнал и логи не пишутся; наружу только подписанный GET на срок.
 */
export const ASSET_REQUESTS_PER_HOUR = 30;
export const CHANNEX_IMPORT_MAX = 20;
export const ASSET_FETCH_DEPS = Symbol('ASSET_FETCH_DEPS');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHOTO_ID_RE = /^[0-9a-f]{64}$/;

/** Предел загрузок и импортов на человека и организацию в час; окна в памяти, как у остальных лимитов API */
const windows = new RateWindows(60 * 60 * 1000, 20_000);
export function resetAssetRateLimit(): void {
  windows.reset();
}

const ASSET_SELECT = {
  id: true,
  kind: true,
  status: true,
  source: true,
  mimeType: true,
  storageRef: true,
  byteSize: true,
  width: true,
  height: true,
  sha256: true,
  defaultAlt: true,
  createdAt: true,
} as const;
type AssetRecord = Prisma.SiteAssetGetPayload<{ select: typeof ASSET_SELECT }>;

/** Тело multipart: только свои поля; филиал, организация и сайт из браузера не принимаются */
function strictFields(body: unknown, allowed: string[]): Record<string, unknown> {
  if (body === undefined || body === null) return {};
  if (typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('Ожидается объект');
  const extra = Object.keys(body).filter((key) => !allowed.includes(key));
  if (extra.length) throw new BadRequestException(`Лишние поля: ${extra.join(', ')}`);
  return body as Record<string, unknown>;
}

function altFrom(raw: unknown): Record<string, string> | null {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      throw new BadRequestException('defaultAlt: JSON вида {"ru": "…"}');
    }
  }
  const parsed = parseDefaultAlt(value);
  if (!parsed.ok) throw new BadRequestException(parsed.message);
  return parsed.value;
}

function imageError(error: unknown): never {
  if (error instanceof AssetImageError) {
    const status = error.code === 'UNSUPPORTED_MEDIA_TYPE' ? 415 : error.code === 'FILE_TOO_LARGE' ? 413 : 422;
    throw new HttpException({ code: error.code, message: error.message }, status);
  }
  throw error;
}

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && (error as { code: unknown }).code === 'P2002';
}

/** Технический лог без ключа объекта, адреса и секретов: только id, код и размеры */
function log(event: string, data: Record<string, unknown>): void {
  console.warn(JSON.stringify({ event, ...data }));
}

/** Код фото Channex для браузера: sha256 адреса; адрес браузер не видит и не присылает */
export function channexPhotoId(url: string): string {
  return createHash('sha256').update(url).digest('hex');
}

@Injectable()
export class SiteAssetsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SITE_ASSET_STORAGE) private readonly storage: SiteAssetStorage | null,
    @Inject(BRIEF_CHANNEX_READER) private readonly reader: ContentReader | null,
    @Inject(ASSET_FETCH_DEPS) private readonly fetchDeps: SafeFetchDeps | null,
  ) {}

  // ---------- библиотека ----------

  async list(pointerSent: boolean) {
    const scope = siteScope(pointerSent);
    const rows = await siteTransaction(this.prisma, scope, false, (tx) =>
      tx.siteAsset.findMany({
        where: { locationId: scope.locationId, status: { not: 'DELETED' } },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: 500,
        select: ASSET_SELECT,
      }),
    );
    return {
      storage: this.storage ? 'READY' : 'OFF',
      limits: { maxUploadBytes: SITE_ASSET_LIMITS.maxUploadBytes },
      assets: await Promise.all(rows.map((r) => this.view(r))),
    };
  }

  async upload(pointerSent: boolean, file: { buffer?: Buffer } | undefined, body: unknown) {
    const scope = siteScope(pointerSent);
    const input = strictFields(body, ['kind', 'defaultAlt']);
    const kind = parseAssetKind(input['kind']);
    if (!kind) throw new BadRequestException('kind: IMAGE, LOGO или FAVICON');
    const alt = altFrom(input['defaultAlt']);
    if (!file?.buffer?.length) throw new BadRequestException('Нужен файл изображения');
    const storage = this.requireStorage();
    this.limit(scope);
    let processed: ProcessedImage;
    try {
      processed = await processSiteImage(file.buffer, kind);
    } catch (error) {
      imageError(error);
    }
    return this.store(scope, storage, kind, processed, 'UPLOAD', alt);
  }

  async updateAlt(pointerSent: boolean, id: string, body: unknown) {
    const scope = siteScope(pointerSent);
    const assetId = this.assetId(id);
    const input = strictFields(body, ['defaultAlt']);
    if (!('defaultAlt' in input)) throw new BadRequestException('defaultAlt: объект или null');
    const alt = altFrom(input['defaultAlt'] ?? null);
    const row = await siteTransaction(this.prisma, scope, true, async (tx) => {
      const found = await tx.siteAsset.findFirst({
        where: { id: assetId, locationId: scope.locationId, status: { not: 'DELETED' } },
        select: { id: true, kind: true, source: true },
      });
      if (!found) throw new NotFoundException('Изображение не найдено');
      const updated = await tx.siteAsset.update({
        where: { id: assetId },
        data: { defaultAlt: alt === null ? Prisma.DbNull : alt },
        select: ASSET_SELECT,
      });
      await this.audit(tx, scope, assetId, 'marketing.site.asset.alt_changed', {
        assetId,
        kind: found.kind,
        source: found.source,
        locales: alt ? Object.keys(alt) : [],
      });
      return updated;
    });
    return { asset: await this.view(row) };
  }

  /**
   * Логическое удаление (план §8). Строка под замком `FOR UPDATE`: публикация, которая проверяет ассеты `FOR SHARE`,
   * либо закончилась раньше (тогда её запись в журнале видна и объект удержан), либо увидит `DELETED`. Объект хоть раз
   * опубликованной версии остаётся ради отката; объект только черновиков удаляется после записи, его сбой не
   * возвращает ассет в библиотеку
   */
  async remove(pointerSent: boolean, id: string) {
    const scope = siteScope(pointerSent);
    const assetId = this.assetId(id);
    const result = await siteTransaction(this.prisma, scope, true, async (tx) => {
      const locked = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT "status"::text AS "status" FROM "site_assets"
        WHERE "id" = ${assetId}::uuid AND "location_id" = ${scope.locationId}::uuid FOR UPDATE`;
      if (!locked.length || locked[0]!.status === 'DELETED') throw new NotFoundException('Изображение не найдено');
      const retained = await assetUsedByPublishedHistory(tx, assetId, scope.locationId);
      const row = await tx.siteAsset.update({
        where: { id: assetId },
        data: { status: 'DELETED', deletedAt: new Date() },
        select: { id: true, kind: true, source: true, storageRef: true },
      });
      await this.audit(tx, scope, assetId, 'marketing.site.asset.deleted', {
        assetId,
        kind: row.kind,
        source: row.source,
        retainedForPublishedHistory: retained,
      });
      return { retained, storageRef: row.storageRef };
    });
    if (!result.retained) {
      if (!this.storage) log('site_assets.cleanup_pending', { assetId, reason: 'storage_off' });
      else
        await this.storage.delete(result.storageRef).catch(() => log('site_assets.cleanup_failed', { assetId, reason: 'delete_failed' }));
    }
    return { deleted: true, retainedForPublishedHistory: result.retained };
  }

  // ---------- Channex ----------

  /** Фото Channex объекта этого филиала: код фото, описание, для номера ли, порядок; адресов нет */
  async channexPhotos(pointerSent: boolean) {
    const scope = siteScope(pointerSent);
    const read = await this.readChannex(scope);
    return {
      state: read.state,
      photos: read.photos.map((p, position) => ({
        photoId: channexPhotoId(p.url),
        description: p.description,
        forRoomType: p.forRoomType,
        position,
      })),
    };
  }

  /**
   * Импорт выбранных фото: сервер заново читает фото объекта этого филиала и сам сопоставляет коды; адрес из браузера
   * не принимается. Каждое фото проходит защищённое скачивание и ту же обработку, что загрузка. Ошибка одного фото не
   * роняет остальные. В документ сайта импорт ничего не вставляет (это MKT9)
   */
  async importChannex(pointerSent: boolean, body: unknown) {
    const scope = siteScope(pointerSent);
    const input = strictFields(body, ['photoIds']);
    const ids = input['photoIds'];
    if (!Array.isArray(ids) || !ids.length || ids.length > CHANNEX_IMPORT_MAX || !ids.every((id) => typeof id === 'string' && PHOTO_ID_RE.test(id)))
      throw new BadRequestException(`photoIds: от 1 до ${CHANNEX_IMPORT_MAX} кодов фото`);
    const wanted = [...new Set(ids as string[])];
    const storage = this.requireStorage();
    this.limit(scope);
    const read = await this.readChannex(scope);
    if (read.state !== 'READY')
      throw new ServiceUnavailableException({ code: 'CHANNEX_UNAVAILABLE', message: 'Фото менеджера каналов сейчас недоступны', state: read.state });
    const byId = new Map(read.photos.map((p) => [channexPhotoId(p.url), p]));
    const locale = await this.siteLocale(scope);
    const imported: unknown[] = [];
    const failed: Array<{ photoId: string; code: string }> = [];
    for (const photoId of wanted) {
      const photo = byId.get(photoId);
      if (!photo) {
        failed.push({ photoId, code: 'UNKNOWN_PHOTO' });
        continue;
      }
      try {
        const bytes = await safeDownload(photo.url, {
          maxBytes: SITE_ASSET_LIMITS.maxUploadBytes,
          ...(this.fetchDeps ? { deps: this.fetchDeps } : {}),
        });
        const processed = await processSiteImage(bytes, 'IMAGE');
        const alt = this.suggestAlt(photo.description, locale);
        const stored = await this.store(scope, storage, 'IMAGE', processed, 'CHANNEX_IMPORT', alt);
        imported.push({ photoId, created: stored.created, asset: stored.asset });
      } catch (error) {
        const code =
          error instanceof SafeFetchError || error instanceof AssetImageError
            ? error.code
            : error instanceof HttpException
              ? ((error.getResponse() as { code?: string })?.code ?? 'IMPORT_FAILED')
              : 'IMPORT_FAILED';
        failed.push({ photoId, code });
      }
    }
    return { imported, failed };
  }

  // ---------- общее ----------

  /**
   * Запись готовой копии: повтор той же картинки того же вида в филиале возвращает тот же ассет; гонка двух одинаковых
   * загрузок даёт одного победителя, проигравший удаляет только свой объект (ключ содержит id)
   */
  private async store(
    scope: SiteScope,
    storage: SiteAssetStorage,
    kind: SiteAssetKind,
    processed: ProcessedImage,
    source: 'UPLOAD' | 'CHANNEX_IMPORT',
    alt: Record<string, string> | null,
  ): Promise<{ asset: Awaited<ReturnType<SiteAssetsService['view']>>; created: boolean }> {
    const live = (tx: DbTx) =>
      tx.siteAsset.findFirst({
        where: { locationId: scope.locationId, kind, sha256: processed.sha256, status: { not: 'DELETED' } },
        select: ASSET_SELECT,
      });
    const existing = await siteTransaction(this.prisma, scope, true, live);
    if (existing) return { asset: await this.view(existing), created: false };
    const id = randomUUID();
    const key = siteAssetStorageKey(scope.locationId, id, processed.sha256, kind);
    try {
      await storage.put({ key, body: processed.bytes, contentType: processed.mimeType });
    } catch {
      log('site_assets.put_failed', { assetId: id, kind, byteSize: processed.byteSize });
      throw new ServiceUnavailableException({ code: 'ASSET_STORAGE_FAILED', message: 'Не удалось сохранить изображение, повторите позже' });
    }
    try {
      const row = await siteTransaction(this.prisma, scope, true, async (tx) => {
        const created = await tx.siteAsset.create({
          data: {
            id,
            locationId: scope.locationId,
            kind,
            status: 'READY',
            source,
            mimeType: processed.mimeType,
            storageRef: key,
            byteSize: processed.byteSize,
            width: processed.width,
            height: processed.height,
            sha256: processed.sha256,
            defaultAlt: alt ?? Prisma.DbNull,
            createdById: currentUserId(),
          },
          select: ASSET_SELECT,
        });
        await this.audit(tx, scope, id, source === 'UPLOAD' ? 'marketing.site.asset.uploaded' : 'marketing.site.asset.imported', {
          assetId: id,
          kind,
          source,
          mimeType: processed.mimeType,
          byteSize: processed.byteSize,
          width: processed.width,
          height: processed.height,
          sha256: processed.sha256,
        });
        return created;
      });
      return { asset: await this.view(row), created: true };
    } catch (error) {
      // строки нет: свой объект убрать; победитель гонки свой объект держит
      await storage.delete(key).catch(() => log('site_assets.orphan_left', { assetId: id }));
      if (isUniqueViolation(error)) {
        const winner = await siteTransaction(this.prisma, scope, false, live);
        if (winner) return { asset: await this.view(winner), created: false };
      }
      throw error;
    }
  }

  async view(row: AssetRecord) {
    return {
      id: row.id,
      kind: row.kind,
      status: row.status,
      source: row.source,
      mimeType: row.mimeType,
      byteSize: row.byteSize,
      width: row.width,
      height: row.height,
      sha256: row.sha256,
      defaultAlt: (row.defaultAlt ?? null) as Record<string, string> | null,
      createdAt: row.createdAt,
      previewUrl: this.storage ? await this.storage.signedGet(row.storageRef, signedUrlTtl()) : null,
    };
  }

  private requireStorage(): SiteAssetStorage {
    if (!this.storage) throw assetStorageUnavailable();
    return this.storage;
  }

  private limit(scope: SiteScope): void {
    if (!windows.allow(`${currentUserId() ?? 'anon'}:${scope.organizationId}`, ASSET_REQUESTS_PER_HOUR, new Date()))
      throw new HttpException({ code: 'RATE_LIMITED', message: 'Лимит загрузок изображений за час исчерпан. Попробуйте позже.' }, 429);
  }

  private assetId(id: string): string {
    if (!UUID_RE.test(id)) throw new NotFoundException('Изображение не найдено');
    return id.toLowerCase();
  }

  /** Тот же объект и то же сопоставление с Channex, что у брифа MKT5; id объекта провайдера наружу не идёт */
  private async readChannex(scope: SiteScope) {
    const providerPropertyId = await siteTransaction(this.prisma, scope, false, async (tx) => {
      const property = await tx.property.findFirst({
        where: { locationId: scope.locationId, organizationId: scope.organizationId },
        select: { id: true },
      });
      if (!property) return null;
      const mapping = await tx.channelMapping.findFirst({
        where: { propertyId: property.id, provider: PROVIDER },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { providerPropertyId: true },
      });
      return mapping?.providerPropertyId ?? null;
    });
    return readChannexContent(this.reader, providerPropertyId);
  }

  /** Язык подсказки ALT: язык по умолчанию последней версии сайта филиала, иначе русский */
  private async siteLocale(scope: SiteScope): Promise<string> {
    const site = await siteTransaction(this.prisma, scope, false, (tx) =>
      tx.marketingSite.findFirst({
        where: { locationId: scope.locationId, state: { not: 'ARCHIVED' } },
        select: { latestVersion: { select: { spec: true } } },
      }),
    );
    const spec = site?.latestVersion?.spec as { site?: { defaultLocale?: unknown } } | undefined;
    const locale = spec?.site?.defaultLocale;
    return locale === 'kk' || locale === 'en' ? locale : 'ru';
  }

  /** Описание фото как подсказка ALT, только если оно проходит правила ALT; не сочиняется и не обрезается */
  private suggestAlt(description: string | null, locale: string): Record<string, string> | null {
    if (!description) return null;
    const parsed = parseDefaultAlt({ [locale]: description });
    return parsed.ok ? parsed.value : null;
  }

  private async audit(tx: DbTx, scope: SiteScope, assetId: string, action: string, after: Prisma.InputJsonObject) {
    await tx.auditLog.create({
      data: {
        organizationId: scope.organizationId,
        userId: currentUserId(),
        entityType: 'site_asset',
        entityId: assetId,
        action,
        after,
      },
    });
  }
}
