/**
 * Ручная проверка S3-хранилища изображений сайта (MKT8, `docs/ops/site-assets-storage.md`). Не для CI.
 *
 *   SITE_ASSET_STORAGE=s3 SITE_ASSET_S3_…=… npx tsx scripts/ops/site-assets-storage-check.ts [--production]
 *
 * Кладёт крошечную созданную здесь же картинку под служебным ключом `site-assets/_check/<uuid>/<sha>.png`, получает её
 * по подписанному GET, сверяет SHA-256, проверяет, что без подписи объект не читается (бакет приватный), и удаляет.
 * Бакет, похожий на рабочий (в имени `prod` или `production`), без флага `--production` не трогает. В вывод не попадают
 * ни ключи, ни подписанный адрес, ни адрес бакета: только шаги и итог.
 */
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { S3SiteAssetStorage, siteAssetStorageConfig } from '../../apps/api/src/marketing-site/asset-storage';

const step = (text: string) => console.log(`• ${text}`);
const fail = (text: string): never => {
  console.error(`✗ ${text}`);
  process.exit(1);
};

const config = siteAssetStorageConfig();
if (!config) fail('хранилище не настроено: SITE_ASSET_STORAGE=s3 и все SITE_ASSET_S3_* обязательны');
const cfg = config!;
if (/prod/i.test(cfg.bucket) && !process.argv.includes('--production'))
  fail('похоже на рабочий бакет: запустите с --production, если это осознанно');

const storage = new S3SiteAssetStorage(cfg);
const body = await sharp({ create: { width: 8, height: 8, channels: 4, background: { r: 0, g: 128, b: 96, alpha: 1 } } })
  .png()
  .toBuffer();
const sha = createHash('sha256').update(body).digest('hex');
const key = `site-assets/_check/${randomUUID()}/${sha}.png`;

try {
  await storage.put({ key, body, contentType: 'image/png' });
  step('запись: готово');
  if (!(await storage.exists(key))) fail('объект не найден сразу после записи');
  step('объект на месте');
  const signed = await storage.signedGet(key, 900);
  const got = await fetch(signed);
  if (!got.ok) fail(`подписанный GET: HTTP ${got.status}`);
  const back = Buffer.from(await got.arrayBuffer());
  if (createHash('sha256').update(back).digest('hex') !== sha) fail('подписанный GET вернул другие байты');
  step('подписанный GET: байты совпали');
  const unsigned = new URL(signed);
  unsigned.search = '';
  const anon = await fetch(unsigned);
  if (anon.ok) fail('объект читается без подписи: бакет не приватный');
  step(`без подписи: отказ HTTP ${anon.status} (бакет приватный)`);
} finally {
  await storage.delete(key).then(
    () => step('удаление: готово'),
    () => console.error('✗ не удалось удалить проверочный объект, уберите его вручную (префикс site-assets/_check/)'),
  );
}
console.log('✓ хранилище изображений отвечает как положено');
