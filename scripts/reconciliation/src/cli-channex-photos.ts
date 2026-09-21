/**
 * Загрузка фотографий объекта в Channex **staging** (photos-collection.md): файл → временная ссылка → запись.
 * Снимки — собственные фотографии объекта с его страницы бронирования, владелец распорядился их использовать
 * 10.09.2026. Порядок задаём осмысленно: сначала общие зоны и номера, вертикальные кадры в конец.
 * Запуск: npx tsx scripts/reconciliation/src/cli-channex-photos.ts <папка с jpg>
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { channex } from '@pms/integrations';
import { serviceFetch } from '../../lib/service-api';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const apiKey = process.env.CHANNEX_API_KEY?.trim();
if (!apiKey) throw new Error('CHANNEX_API_KEY пуст');
const baseUrl = process.env.CHANNEX_API_BASE_URL?.trim() || 'https://staging.channex.io/api/v1';
if (!baseUrl.includes('staging')) throw new Error(`Только staging: ${baseUrl}`);
const dir = process.argv[2];
if (!dir) throw new Error('укажите папку с файлами .jpg');
const api = process.env.APP_API_URL ?? 'http://localhost:3001';

/** Что изображено — проверено глазами, а не угадано по имени файла. */
const CAPTIONS: Record<string, string> = {
  '695920058': 'Стойка регистрации',
  '695923287': 'Лаундж и мини-маркет',
  '744284081': 'Общая рабочая зона',
  '695922784': 'Общая зона отдыха',
  '695926484': 'Койко-места в общем номере',
  '695931262': 'Двухместный номер',
  '695920751': 'Общие душевые',
  '679832532': 'Вход в хостел',
};
const ORDER = [
  '695920058',
  '695931262',
  '695926484',
  '695923287',
  '744284081',
  '695922784',
  '695920751',
  '679832532',
];

const mapping = (await (await serviceFetch(`${api}/channels/channex/mapping`)).json()) as Array<{
  providerPropertyId: string;
}>;
const propertyId = mapping[0]?.providerPropertyId;
if (!propertyId) throw new Error('объект в Channex не создан — сначала setup');

const client = new channex.ChannexClient({ apiKey, baseUrl });
const existing = await client.listAll<Record<string, unknown>>('/photos', {
  'filter[property_id]': propertyId,
});
if (existing.length > 0) {
  console.log(`у объекта уже ${existing.length} фотографий — повторная загрузка пропущена`);
  process.exit(0);
}

const files = readdirSync(resolve(dir)).filter((f) => f.endsWith('.jpg'));
const byId = new Map(files.map((f) => [f.replace('.jpg', ''), f]));
let position = 0;
for (const id of ORDER) {
  const file = byId.get(id);
  if (!file) continue;
  const bytes = readFileSync(resolve(dir, file));
  const url = await client.uploadPhoto(
    new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }),
    file,
  );
  const description = CAPTIONS[id] ?? 'Фотография объекта';
  const photo = await client.createPhoto({ property_id: propertyId, url, description, position });
  console.log(`  ${position}. ${description} → ${photo.id}`);
  position += 1;
}
console.log(`загружено фотографий: ${position}`);
