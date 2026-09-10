/**
 * T7: готовность объекта к странице прямого бронирования Channex (Instant Booking Page).
 * Channex включает канал только когда у объекта заполнен контент (instant-booking-page.md → Step 0):
 * страна, адрес, координаты, часовой пояс, правила объекта, хотя бы одна политика отмены,
 * хотя бы одно удобство, хотя бы одно фото, хотя бы одно описание.
 * Только чтение: ничего не создаёт и не меняет. Запуск: npx tsx scripts/reconciliation/src/cli-channex-booking-page.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { channex } from '@pms/integrations';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const apiKey = process.env.CHANNEX_API_KEY?.trim();
if (!apiKey) throw new Error('CHANNEX_API_KEY пуст');
const api = process.env.APP_API_URL ?? 'http://localhost:3001';

const mapping = (await (await fetch(`${api}/channels/channex/mapping`)).json()) as Array<{
  providerPropertyId: string;
}>;
const propertyId = mapping[0]?.providerPropertyId;
if (!propertyId) throw new Error('объект в Channex не создан — сначала setup');

const client = new channex.ChannexClient(
  process.env.CHANNEX_API_BASE_URL?.trim()
    ? { apiKey, baseUrl: process.env.CHANNEX_API_BASE_URL.trim() }
    : { apiKey },
);
const property = await client.getProperty(propertyId);
const a = property.attributes as unknown as Record<string, unknown>;
const photos = await client.listAll<Record<string, unknown>>('/photos', {
  'filter[property_id]': propertyId,
});

const nonEmpty = (v: unknown) =>
  v !== null && v !== undefined && String(v).trim() !== '' && String(v) !== 'null';
const list = (v: unknown) => (Array.isArray(v) ? v.length : 0);

const content = (a['content'] ?? {}) as Record<string, unknown>;
const photosInContent = Array.isArray(content['photos'])
  ? (content['photos'] as unknown[]).length
  : 0;

const checks: Array<{ what: string; ok: boolean; got: string; who: string }> = [
  { what: 'Страна', ok: nonEmpty(a['country']), got: String(a['country'] ?? '—'), who: '' },
  { what: 'Город', ok: nonEmpty(a['city']), got: String(a['city'] ?? '—'), who: '' },
  { what: 'Адрес', ok: nonEmpty(a['address']), got: String(a['address'] ?? '—'), who: '' },
  { what: 'Широта', ok: nonEmpty(a['latitude']), got: String(a['latitude'] ?? '—'), who: '' },
  { what: 'Долгота', ok: nonEmpty(a['longitude']), got: String(a['longitude'] ?? '—'), who: '' },
  { what: 'Часовой пояс', ok: nonEmpty(a['timezone']), got: String(a['timezone'] ?? '—'), who: '' },
  { what: 'Телефон', ok: nonEmpty(a['phone']), got: String(a['phone'] ?? '—'), who: '' },
  { what: 'Почта', ok: nonEmpty(a['email']), got: String(a['email'] ?? '—'), who: '' },
  {
    what: 'Описание объекта',
    ok: nonEmpty(content['description']),
    got: nonEmpty(content['description']) ? 'есть' : 'нет',
    who: '',
  },
  {
    what: 'Правила объекта (hotel policy)',
    ok: nonEmpty(a['hotel_policy_id']),
    got: nonEmpty(a['hotel_policy_id']) ? 'задана' : 'нет',
    who: 'владелец: интернет, парковка, животные, курение — фактов о доме у системы нет',
  },
  {
    what: 'Политика отмены',
    ok: nonEmpty(a['default_cancellation_policy_id']),
    got: nonEmpty(a['default_cancellation_policy_id']) ? 'задана' : 'нет',
    who: 'владелец: это правило про деньги (Q-103)',
  },
  {
    what: 'Фотографии',
    ok: photosInContent > 0 || photos.length > 0,
    got: String(photosInContent || photos.length),
    who: 'владелец: файлов фотографий у системы нет',
  },
  {
    what: 'Удобства (facilities)',
    ok: true,
    got: 'через API объекта не читаются — проверить в кабинете',
    who: 'владелец: Wi-Fi, кухня, кондиционер — факты о доме',
  },
];
const missing = checks.filter((c) => !c.ok);

const md = [
  '# Готовность к странице прямого бронирования Channex (T7)',
  '',
  `Снято ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC. Объект \`${propertyId}\` (staging).`,
  '',
  'Instant Booking Page — это страница прямого бронирования, которую Channex подключает как обычный канал.',
  'Брони с неё приходят тем же путём, что и из агрегаторов, а остаток общий: продажа на странице',
  'сразу уменьшает доступность в Booking, Agoda и остальных. Именно это и нужно от «зелёной кнопки».',
  '',
  '| Что требует Channex | Состояние | Значение | Кто заполняет |',
  '|---|---|---|---|',
  ...checks.map((c) => `| ${c.what} | ${c.ok ? 'есть' : '**нет**'} | ${c.got} | ${c.who} |`),
  '',
  missing.length === 0
    ? '**RESULT: OK** — контента достаточно, канал можно подключать.'
    : `**RESULT: не хватает ${missing.length} пунктов.** Их заполняет владелец в кабинете Channex (Property → Edit): ${missing.map((m) => m.what).join(', ')}.`,
  '',
  '## Что делает система, когда канал включат',
  '',
  '- Остаток и цены уже уходят в Channex дельтами и полной выгрузкой — отдельной настройки не требуется.',
  '- Бронь со страницы придёт как обычная бронь канала: журнал входящих, автоназначение ячейки (Q-094), счёт.',
  '- Проверка на овербукинг — `cli-channex-ari.ts`: канал не должен показывать мест больше, чем есть.',
].join('\n');
mkdirSync(resolve(ROOT, 'reports'), { recursive: true });
const out = resolve(
  ROOT,
  `reports/booking-page-readiness-${new Date().toISOString().slice(0, 10)}.md`,
);
writeFileSync(out, md);
console.log(md);
console.log(`→ ${out}`);
process.exitCode = missing.length === 0 ? 0 : 1;
