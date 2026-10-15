import { S3Client } from '@aws-sdk/client-s3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MemorySiteAssetStorage,
  S3SiteAssetStorage,
  signedUrlTtl,
  siteAssetStorageConfig,
  siteAssetStorageFromEnv,
} from './asset-storage';

/** MKT8: хранилище закрыто по умолчанию, адаптер S3 шлёт только свои команды, подпись без секрета, память для тестов */
const FULL = {
  SITE_ASSET_STORAGE: 's3',
  SITE_ASSET_S3_ENDPOINT: 'https://object.storage.example.kz',
  SITE_ASSET_S3_REGION: 'kz-ala-1',
  SITE_ASSET_S3_BUCKET: 'wetop-site-assets',
  SITE_ASSET_S3_ACCESS_KEY_ID: 'AKIATESTACCESSKEY',
  SITE_ASSET_S3_SECRET_ACCESS_KEY: 'super-secret-value-never-in-url',
  SITE_ASSET_S3_FORCE_PATH_STYLE: '1',
} as const;
const KEY = `site-assets/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/${'a'.repeat(64)}.webp`;

afterEach(() => vi.restoreAllMocks());

describe('MKT8: настройка хранилища из окружения', () => {
  it('по умолчанию и при off хранилища нет', () => {
    expect(siteAssetStorageConfig({})).toBeNull();
    expect(siteAssetStorageConfig({ ...FULL, SITE_ASSET_STORAGE: 'off' })).toBeNull();
    expect(siteAssetStorageFromEnv({})).toBeNull();
  });

  it('s3 с полной настройкой: адаптер; без любого значения: хранилища нет (запасного нет)', () => {
    expect(siteAssetStorageConfig(FULL)).toMatchObject({ bucket: 'wetop-site-assets', forcePathStyle: true });
    for (const key of ['SITE_ASSET_S3_ENDPOINT', 'SITE_ASSET_S3_REGION', 'SITE_ASSET_S3_BUCKET', 'SITE_ASSET_S3_ACCESS_KEY_ID', 'SITE_ASSET_S3_SECRET_ACCESS_KEY'])
      expect(siteAssetStorageConfig({ ...FULL, [key]: '' })).toBeNull();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(siteAssetStorageFromEnv({ ...FULL, SITE_ASSET_S3_BUCKET: '' })).toBeNull();
    expect(siteAssetStorageFromEnv(FULL)).toBeInstanceOf(S3SiteAssetStorage);
    for (const call of warn.mock.calls) expect(JSON.stringify(call)).not.toContain(FULL.SITE_ASSET_S3_SECRET_ACCESS_KEY);
  });

  it('адрес только https (http лишь localhost), без пути, логина и запроса', () => {
    expect(siteAssetStorageConfig({ ...FULL, SITE_ASSET_S3_ENDPOINT: 'http://object.storage.example.kz' })).toBeNull();
    expect(siteAssetStorageConfig({ ...FULL, SITE_ASSET_S3_ENDPOINT: 'https://u:p@object.storage.example.kz' })).toBeNull();
    expect(siteAssetStorageConfig({ ...FULL, SITE_ASSET_S3_ENDPOINT: 'https://object.storage.example.kz/bucket' })).toBeNull();
    expect(siteAssetStorageConfig({ ...FULL, SITE_ASSET_S3_ENDPOINT: 'not a url' })).toBeNull();
    expect(siteAssetStorageConfig({ ...FULL, SITE_ASSET_S3_ENDPOINT: 'http://127.0.0.1:9000' })).not.toBeNull();
    expect(siteAssetStorageConfig({ ...FULL, SITE_ASSET_S3_BUCKET: 'Bad_Bucket' })).toBeNull();
  });

  it('срок подписи: 3600 по умолчанию, от 900 до 86 400', () => {
    expect(signedUrlTtl({})).toBe(3600);
    expect(signedUrlTtl({ SITE_ASSET_SIGNED_URL_TTL_SECONDS: '60' })).toBe(900);
    expect(signedUrlTtl({ SITE_ASSET_SIGNED_URL_TTL_SECONDS: '999999' })).toBe(86_400);
    expect(signedUrlTtl({ SITE_ASSET_SIGNED_URL_TTL_SECONDS: '1800' })).toBe(1800);
    expect(signedUrlTtl({ SITE_ASSET_SIGNED_URL_TTL_SECONDS: 'x' })).toBe(3600);
  });
});

describe('MKT8: адаптер S3', () => {
  const config = siteAssetStorageConfig(FULL)!;
  const client = () =>
    new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: true,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });

  it('put, delete, exists: только свой бакет и ключ; без ACL; 404 значит «нет»', async () => {
    const c = client();
    const sent: Array<{ name: string; input: Record<string, unknown> }> = [];
    vi.spyOn(c, 'send').mockImplementation(async (command: { constructor: { name: string }; input: object }) => {
      sent.push({ name: command.constructor.name, input: command.input as Record<string, unknown> });
      if (command.constructor.name === 'HeadObjectCommand' && (command.input as { Key: string }).Key.endsWith('missing'))
        throw Object.assign(new Error('NotFound'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } });
      return {};
    });
    const storage = new S3SiteAssetStorage(config, c);
    await storage.put({ key: KEY, body: Buffer.from('webp'), contentType: 'image/webp' });
    await storage.delete(KEY);
    expect(await storage.exists(KEY)).toBe(true);
    expect(await storage.exists(`${KEY}.missing`)).toBe(false);
    expect(sent.map((s) => s.name)).toEqual(['PutObjectCommand', 'DeleteObjectCommand', 'HeadObjectCommand', 'HeadObjectCommand']);
    expect(sent[0]!.input).toMatchObject({ Bucket: 'wetop-site-assets', Key: KEY, ContentType: 'image/webp', ContentLength: 4 });
    expect(sent[0]!.input).not.toHaveProperty('ACL');
    for (const s of sent) expect(s.input['Bucket']).toBe('wetop-site-assets');
  });

  it('exists: иная ошибка хранилища не превращается в «нет объекта»', async () => {
    const c = client();
    vi.spyOn(c, 'send').mockImplementation(async () => {
      throw Object.assign(new Error('AccessDenied'), { name: 'AccessDenied', $metadata: { httpStatusCode: 403 } });
    });
    await expect(new S3SiteAssetStorage(config, c).exists(KEY)).rejects.toThrow(/AccessDenied/);
  });

  it('подписанный GET: один объект, срок в адресе, секрета в адресе нет; сети не нужно', async () => {
    const url = new URL(await new S3SiteAssetStorage(config, client()).signedGet(KEY, 3600));
    expect(url.protocol).toBe('https:');
    expect(url.host).toBe('object.storage.example.kz');
    expect(url.pathname).toBe(`/wetop-site-assets/${KEY}`);
    expect(url.searchParams.get('X-Amz-Expires')).toBe('3600');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    expect(url.toString()).not.toContain(FULL.SITE_ASSET_S3_SECRET_ACCESS_KEY);
    expect(url.searchParams.get('x-id')).toBe('GetObject');
  });
});

describe('MKT8: хранилище в памяти', () => {
  it('подпись проверяется, срок выходит, чужая подпись не проходит', async () => {
    let now = 1_000_000_000_000;
    const storage = new MemorySiteAssetStorage('https://assets.storage.test', 'secret', () => now);
    await storage.put({ key: KEY, body: Buffer.from('x'), contentType: 'image/webp' });
    const url = await storage.signedGet(KEY, 3600);
    expect(storage.verify(url)).toEqual({ key: KEY });
    expect(storage.verify(url.replace(/X-Signature=[0-9a-f]+/, 'X-Signature=00'))).toBeNull();
    now += 3601_000;
    expect(storage.verify(url)).toBeNull();
    expect(await storage.exists(KEY)).toBe(true);
  });
});
