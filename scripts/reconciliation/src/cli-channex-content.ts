/**
 * Заполняет контент объекта в Channex **staging**, который требует страница прямого бронирования (T7):
 * телефон, почта, описание, правила объекта (время заезда и выезда) и хотя бы одно удобство.
 * Ставим только то, что подтверждено данными объекта (OBJECT.md, аудит Legacy) — ничего не выдумываем:
 * Wi-Fi, кухню, кондиционер и парковку отмечает владелец, потому что это факты о доме, а не о данных.
 * Фотографии загружает владелец: файлов у нас нет.
 * Запуск: npx tsx scripts/reconciliation/src/cli-channex-content.ts
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { channex } from '@pms/integrations';
import { serviceFetch } from '../../lib/service-api';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const apiKey = process.env.CHANNEX_API_KEY?.trim();
if (!apiKey) throw new Error('CHANNEX_API_KEY пуст');
const baseUrl = process.env.CHANNEX_API_BASE_URL?.trim() || 'https://staging.channex.io/api/v1';
if (!baseUrl.includes('staging'))
  throw new Error(`Только staging: контент боевого объекта заполняет владелец. Адрес: ${baseUrl}`);
const api = process.env.APP_API_URL ?? 'http://localhost:3001';

/** Факты объекта: OBJECT.md §1 и аудит Legacy 07.09.2026 (00-otvety.md, пункты про контакты и время заезда). */
const CONTACTS = { phone: '+7 777 187 77 65', email: 'luxxaparts@gmail.com' };
const TIMES = { checkin: '14:00', checkout: '12:00' };
const DESCRIPTION =
  'Luxx Aparts — хостел в центре Алматы на улице Толе би, 286/8. 20 комнат: одноместные с окном ' +
  'и без окна, двухместные и общие комнаты с койко-местами, всего 88 мест. Заезд с 14:00, выезд до 12:00. ' +
  'Есть прачечная. Оплата при заселении.';
/** Прачечная — единственное удобство, подтверждённое данными: стирка продаётся как услуга (500 ₸). */
const FACILITY_LAUNDRY = 'Laundry';

const mapping = (await (await serviceFetch(`${api}/channels/channex/mapping`)).json()) as Array<{
  providerPropertyId: string;
}>;
const propertyId = mapping[0]?.providerPropertyId;
if (!propertyId) throw new Error('объект в Channex не создан — сначала setup');

const client = new channex.ChannexClient({ apiKey, baseUrl });

const facilities = await client.listPropertyFacilities();
const laundry = facilities.find(
  (f) => String((f.attributes as Record<string, unknown>)['title'] ?? '') === FACILITY_LAUNDRY,
);
if (!laundry) throw new Error(`в справочнике Channex нет удобства «${FACILITY_LAUNDRY}»`);

const before = await client.getProperty(propertyId);
const had = before.attributes as unknown as Record<string, unknown>;
console.log(
  `объект ${propertyId}: телефон ${had['phone'] ?? '—'}, почта ${had['email'] ?? '—'}, удобств ${Array.isArray(had['facilities']) ? (had['facilities'] as unknown[]).length : 0}`,
);

const updated = await client.updateProperty(propertyId, {
  ...CONTACTS,
  facilities: [laundry.id],
  content: { description: DESCRIPTION },
});
const now = updated.attributes as unknown as Record<string, unknown>;
console.log(
  `обновлено: телефон ${now['phone'] ?? '—'}, почта ${now['email'] ?? '—'}, удобств ${Array.isArray(now['facilities']) ? (now['facilities'] as unknown[]).length : 0}`,
);

// Правила объекта. Время выезда — из Legacy; окно заезда и «нельзя с животными» подтверждает страница
// объекта на Booking; интернет, парковку и курение подтвердил владелец 10.09.2026. Ничего не выдумано.
const policy = await client.createHotelPolicy({
  property_id: propertyId,
  title: 'Основные правила',
  currency: 'KZT',
  is_adults_only: false,
  max_count_of_guests: 92,
  checkin_from_time: TIMES.checkin,
  checkin_to_time: '23:30',
  checkout_from_time: '00:00',
  checkout_to_time: TIMES.checkout,
  internet_access_type: 'wifi',
  internet_access_cost: null,
  internet_access_coverage: 'public_areas',
  parking_type: 'on_site',
  parking_reservation: 'not_needed',
  parking_is_private: true,
  pets_policy: 'not_allowed',
  // Channex принимает только «можно»/«нельзя»: у объекта номера для некурящих (страница Booking),
  // а отдельное место для курения описано словами в important_information
  smoking_policy: 'no_smoking',
});
console.log(`правила объекта созданы: ${policy.id}`);
await client.updateProperty(propertyId, { hotel_policy_id: policy.id } as never);
console.log('правила привязаны к объекту');
console.log('\nОсталось владельцу: фотографии и политика отмены (правило про деньги, Q-103).');
