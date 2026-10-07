import { createHash, createHmac } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Хранилище изображений сайта (MKT8, Q-270 RESOLVED OWNER 07.10.2026): приватный S3-совместимый бакет физически в
 * Казахстане. Интерфейс не знает поставщика: PS Cloud, Cloud24 или другой казахстанский S3 отличаются только
 * переменными окружения. В базе лежит только ключ объекта (`storage_ref`), никогда не адрес и не подпись.
 *
 * Закрыто по умолчанию: `SITE_ASSET_STORAGE=off` или неполная настройка значит «хранилища нет»; запасного диска, R2 или
 * Supabase нет. Браузер ключей не получает: только подписанный GET на конкретный объект и на ограниченное время.
 */
export interface SiteAssetStorage {
  put(input: { key: string; body: Buffer; contentType: string }): Promise<void>;
  delete(key: string): Promise<void>;
  /** Подписанный GET одного объекта; список бакета, запись и удаление такой ссылкой невозможны */
  signedGet(key: string, expiresInSeconds: number): Promise<string>;
  exists(key: string): Promise<boolean>;
}

export const SITE_ASSET_STORAGE = Symbol('SITE_ASSET_STORAGE');

export interface SiteAssetStorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

export const SIGNED_URL_TTL_DEFAULT = 3600;
const SIGNED_URL_TTL_MIN = 900;
const SIGNED_URL_TTL_MAX = 86_400;

/**
 * Срок подписи (`SITE_ASSET_SIGNED_URL_TTL_SECONDS`, по умолчанию 3600, от 900 до 86 400): заметно дольше кэша
 * страницы (60 с) и устаревшей копии контракта Worker (10 мин), чтобы картинка не пропала с уже отданной страницы
 */
export function signedUrlTtl(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.SITE_ASSET_SIGNED_URL_TTL_SECONDS;
  if (raw === undefined || raw === '') return SIGNED_URL_TTL_DEFAULT;
  const n = Number(raw);
  if (!Number.isInteger(n)) return SIGNED_URL_TTL_DEFAULT;
  return Math.min(SIGNED_URL_TTL_MAX, Math.max(SIGNED_URL_TTL_MIN, n));
}

/** Адрес S3: только `https:`; `http:` лишь на 127.0.0.1 и localhost для стенда разработчика. Без пути, логина и запроса */
function endpointOk(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) return false;
    const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    return url.protocol === 'https:' || (url.protocol === 'http:' && local);
  } catch {
    return false;
  }
}

/** Настройка из окружения или null (хранилища нет). Значения ключей наружу не выводятся ни здесь, ни в логах */
export function siteAssetStorageConfig(env: NodeJS.ProcessEnv = process.env): SiteAssetStorageConfig | null {
  if ((env.SITE_ASSET_STORAGE ?? 'off').trim().toLowerCase() !== 's3') return null;
  const endpoint = env.SITE_ASSET_S3_ENDPOINT?.trim() ?? '';
  const region = env.SITE_ASSET_S3_REGION?.trim() ?? '';
  const bucket = env.SITE_ASSET_S3_BUCKET?.trim() ?? '';
  const accessKeyId = env.SITE_ASSET_S3_ACCESS_KEY_ID?.trim() ?? '';
  const secretAccessKey = env.SITE_ASSET_S3_SECRET_ACCESS_KEY?.trim() ?? '';
  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) return null;
  if (!endpointOk(endpoint)) return null;
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) return null;
  return {
    endpoint: endpoint.replace(/\/+$/, ''),
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    forcePathStyle: env.SITE_ASSET_S3_FORCE_PATH_STYLE === '1',
  };
}

let warned = false;

export function siteAssetStorageFromEnv(env: NodeJS.ProcessEnv = process.env): SiteAssetStorage | null {
  const config = siteAssetStorageConfig(env);
  if (!config && (env.SITE_ASSET_STORAGE ?? '').trim().toLowerCase() === 's3' && !warned) {
    warned = true;
    console.warn(JSON.stringify({ event: 'site_assets.storage_misconfigured', message: 'SITE_ASSET_STORAGE=s3, но настройка неполная или неверная: хранилище выключено' }));
  }
  return config ? new S3SiteAssetStorage(config) : null;
}

/** S3-совместимый бакет через AWS SDK v3; своей подписи SigV4 нет */
export class S3SiteAssetStorage implements SiteAssetStorage {
  private readonly client: S3Client;

  constructor(
    private readonly config: SiteAssetStorageConfig,
    client?: S3Client,
  ) {
    this.client =
      client ??
      new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        forcePathStyle: config.forcePathStyle,
        credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
        // S3-совместимые поставщики не обязаны понимать новые заголовки контрольных сумм AWS: только когда требует сервер
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
        maxAttempts: 3,
      });
  }

  async put(input: { key: string; body: Buffer; contentType: string }): Promise<void> {
    // без ACL: объект приватный, как бакет; кэш на стороне получателя подписанной ссылки, адрес у версии свой
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        ContentLength: input.body.length,
        CacheControl: 'private, max-age=86400',
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }

  signedGet(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.config.bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }));
      return true;
    } catch (error) {
      const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (e.name === 'NotFound' || e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) return false;
      throw error;
    }
  }
}

/**
 * Хранилище в памяти: для тестов и стенда UI (не для рабочего сервера: перезапуск теряет объекты). Подпись похожа на
 * настоящую по форме (срок и подпись в адресе), чтобы тесты проверяли, что ключ и секрет в адрес не попадают
 */
export class MemorySiteAssetStorage implements SiteAssetStorage {
  readonly objects = new Map<string, { body: Buffer; contentType: string }>();
  failPut = false;
  failDelete = false;
  readonly deleted: string[] = [];

  constructor(
    private readonly origin = 'https://assets.storage.test',
    private readonly secret = 'memory-storage-secret',
    private readonly now: () => number = Date.now,
  ) {}

  async put(input: { key: string; body: Buffer; contentType: string }): Promise<void> {
    if (this.failPut) throw new Error('storage put failed');
    this.objects.set(input.key, { body: Buffer.from(input.body), contentType: input.contentType });
  }

  async delete(key: string): Promise<void> {
    if (this.failDelete) throw new Error('storage delete failed');
    this.deleted.push(key);
    this.objects.delete(key);
  }

  async signedGet(key: string, expiresInSeconds: number): Promise<string> {
    const expires = Math.floor(this.now() / 1000) + expiresInSeconds;
    const signature = createHmac('sha256', this.secret).update(`${key}\n${expires}`).digest('hex');
    return `${this.origin}/${key}?X-Expires=${expires}&X-Signature=${signature}`;
  }

  /** Проверка подписи стенда: адрес настоящий, срок не вышел, подпись сходится */
  verify(url: string): { key: string } | null {
    const u = new URL(url);
    if (u.origin !== this.origin) return null;
    const key = decodeURIComponent(u.pathname.slice(1));
    const expires = Number(u.searchParams.get('X-Expires'));
    const signature = u.searchParams.get('X-Signature') ?? '';
    if (!Number.isFinite(expires) || expires * 1000 < this.now()) return null;
    const expected = createHmac('sha256', this.secret).update(`${key}\n${expires}`).digest('hex');
    return signature === expected ? { key } : null;
  }

  async exists(key: string): Promise<boolean> {
    return this.objects.has(key);
  }

  sha256Of(key: string): string | null {
    const o = this.objects.get(key);
    return o ? createHash('sha256').update(o.body).digest('hex') : null;
  }
}
