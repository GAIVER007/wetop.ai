import 'reflect-metadata';
import {
  BadRequestException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  normalizeSiteHost,
  SITE_SPEC_SCHEMA_VERSION,
  siteSpecCategoryCodes,
  siteSpecHash,
  validateSiteSpec,
} from '@pms/domain';
import { withServiceDatabase } from '../auth/request-context';
import { publicApiUrl } from '../analytics/analytics.service';
import { previewSecretFromEnv, verifyPreviewToken } from '../marketing-site/preview-token';
import { resolveSiteHost } from './host-resolver';
import {
  SITES_RUNTIME_REPOSITORY,
  type PublishedSiteRow,
  type SitesRuntimeRepository,
} from './sites-runtime.repository';

/** Ответ без имени сайта: неизвестный хост, черновик, пауза и архив неотличимы снаружи */
export const SITE_NOT_FOUND = 'Сайт не найден';
const HASH_RE = /^[0-9a-f]{64}$/;

export interface PublicCategoryFact {
  code: string;
  active: boolean;
  capacityAdults?: number;
}

export interface PublicFacts {
  loadedAt: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  categories: PublicCategoryFact[];
}

/** Контракт `GET /sites-runtime/current` (`docs/marketing/README.md` §4.2, план MKT4 §6) */
export interface RuntimeCurrent {
  siteId: string;
  state: 'PUBLISHED';
  primaryHost: string | null;
  defaultLocale: string;
  versionId: string;
  schemaVersion: string;
  specHash: string;
  spec?: Record<string, unknown>;
  publicKey: string | null;
  bookingEnabled: boolean;
  publicApiUrl: string;
  assets: Record<string, string>;
  publicFacts: PublicFacts | null;
}

/** MKT7: контракт `GET /sites-runtime/preview`: одна версия из токена, без ключа сайта и брони, до `expiresAt` */
export interface RuntimePreview extends Omit<RuntimeCurrent, 'state'> {
  state: 'PREVIEW';
  expiresAt: string;
}

/** Ссылка превью устарела: отличается от испорченной только кодом, без подробностей */
export const PREVIEW_EXPIRED = { code: 'preview_expired', message: 'Ссылка предпросмотра устарела' };

/**
 * Публичный рантайм видит только **текущую опубликованную** версию сайта, разрешённого по хосту (инвариант R1, S3).
 * Организация, филиал и объект берутся из строки сайта, а не из запроса. Документ перед выдачей проходит тот же
 * валидатор, что сохранение: неверный закрывает выдачу (503 и лог), старой копии API не отдаёт.
 */
@Injectable()
export class SitesRuntimeService {
  constructor(@Inject(SITES_RUNTIME_REPOSITORY) private readonly repo: SitesRuntimeRepository) {}

  async current(query: { host?: unknown; knownSpecHash?: unknown }, now = new Date()): Promise<RuntimeCurrent> {
    const known = query.knownSpecHash;
    if (known !== undefined && (typeof known !== 'string' || !HASH_RE.test(known)))
      throw new BadRequestException('knownSpecHash: sha256 в hex');
    const siteId = await this.siteIdFor(query.host);
    if (!siteId) throw new NotFoundException(SITE_NOT_FOUND);
    const row = await withServiceDatabase(() => this.repo.publishedSite(siteId));
    if (!row) throw new NotFoundException(SITE_NOT_FOUND);
    const defaultLocale = this.checkedLocale(row);
    return {
      siteId: row.siteId,
      state: 'PUBLISHED',
      primaryHost: row.primaryHost ?? null,
      defaultLocale,
      versionId: row.versionId,
      schemaVersion: row.schemaVersion,
      specHash: row.specHash,
      ...(known === row.specHash ? {} : { spec: row.spec }),
      publicKey: row.publicKey,
      bookingEnabled: row.bookingEnabled,
      publicApiUrl: publicApiUrl(),
      assets: {},
      publicFacts: await this.facts(row, now),
    };
  }

  /**
   * Хост → сайт (MKT7): карта dev и test действует только вне `production` (MKT4); дальше только домен `ACTIVE` из
   * `site_domains`. Снятый, ждущий и неизвестный хост одинаково «сайта нет»
   */
  private async siteIdFor(raw: unknown): Promise<string | null> {
    const mapped = resolveSiteHost(raw);
    if (mapped) return mapped;
    const host = normalizeSiteHost(raw);
    return host ? withServiceDatabase(() => this.repo.siteIdByHost(host)) : null;
  }

  /**
   * Превью (MKT7): ключ рантайма сам ничего не читает, нужен действующий токен, подписанный управлением; читается ровно
   * версия из токена. Испорченный токен 404, истёкший 410, нет секрета 503 (превью закрыто, а не открыто)
   */
  async preview(query: { token?: unknown }, now = new Date()): Promise<RuntimePreview> {
    const secret = previewSecretFromEnv();
    if (!secret) throw new ServiceUnavailableException({ code: 'preview_disabled', message: 'Предпросмотр недоступен' });
    const checked = verifyPreviewToken(query.token, secret, Math.floor(now.getTime() / 1000));
    if (!checked.ok) {
      if (checked.reason === 'expired') throw new GoneException(PREVIEW_EXPIRED);
      throw new NotFoundException(SITE_NOT_FOUND);
    }
    const row = await withServiceDatabase(() => this.repo.previewSite(checked.siteId, checked.versionId));
    if (!row) throw new NotFoundException(SITE_NOT_FOUND);
    const defaultLocale = this.checkedLocale(row);
    return {
      siteId: row.siteId,
      state: 'PREVIEW',
      primaryHost: null,
      defaultLocale,
      versionId: row.versionId,
      schemaVersion: row.schemaVersion,
      specHash: row.specHash,
      spec: row.spec,
      publicKey: null,
      bookingEnabled: false,
      publicApiUrl: publicApiUrl(),
      assets: {},
      publicFacts: await this.facts(row, now),
      expiresAt: new Date(checked.exp * 1000).toISOString(),
    };
  }

  /** Тот же валидатор, что у сохранения, плюс совпадение версии схемы и хэша; иначе 503 и строка в лог */
  private checkedLocale(row: PublishedSiteRow): string {
    const result = validateSiteSpec(row.spec);
    const reason = !result.ok
      ? `invalid:${result.errors.slice(0, 3).map((e) => `${e.path}:${e.code}`).join(',')}`
      : row.schemaVersion !== SITE_SPEC_SCHEMA_VERSION
        ? `schema:${row.schemaVersion}`
        : siteSpecHash(row.spec) !== row.specHash
          ? 'hash_mismatch'
          : null;
    if (reason) {
      console.error(
        JSON.stringify({ event: 'sites_runtime.spec_invalid', siteId: row.siteId, versionId: row.versionId, reason }),
      );
      throw new ServiceUnavailableException({ code: 'spec_invalid', message: 'Сайт временно недоступен' });
    }
    const site = row.spec['site'] as { defaultLocale: string };
    return site.defaultLocale;
  }

  /** Белый список `publicFacts` (§4.4): не загрузились, значит null, а не выдуманные значения */
  private async facts(row: PublishedSiteRow, now: Date): Promise<PublicFacts | null> {
    const codes = siteSpecCategoryCodes(row.spec);
    try {
      const found = await withServiceDatabase(() => this.repo.categories(row.propertyId, codes));
      const byCode = new Map(found.map((c) => [c.code, c]));
      return {
        loadedAt: now.toISOString(),
        checkInTime: clock(row.checkInTime),
        checkOutTime: clock(row.checkOutTime),
        categories: codes.map((code) => {
          const c = byCode.get(code);
          return c ? { code, active: c.active === true, capacityAdults: Number(c.capacityAdults) } : { code, active: false };
        }),
      };
    } catch (error) {
      console.error(
        JSON.stringify({ event: 'sites_runtime.facts_failed', siteId: row.siteId, error: (error as Error).message }),
      );
      return null;
    }
  }
}

function clock(value: string | null): string | null {
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value) ? value : null;
}
