/**
 * Тестовая бронь на Channex **staging** через Booking CRS API (booking-crs-api.md → Create Booking):
 * проверка приёма броней через webhook. Только песочница: на не-staging адресе отказывается работать.
 * Гость вымышленный (ADR-010). Запуск: npx tsx scripts/reconciliation/src/cli-channex-test-booking.ts [categoryCode] [nights]
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { channex } from '@pms/integrations';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const apiKey = process.env.CHANNEX_API_KEY?.trim();
if (!apiKey) throw new Error('CHANNEX_API_KEY пуст');
const baseUrl = process.env.CHANNEX_API_BASE_URL?.trim() || 'https://staging.channex.io/api/v1';
if (!baseUrl.includes('staging')) throw new Error(`Только staging: ${baseUrl}`);

const category = process.argv[2] ?? 'exely-5074688';
const nights = Number(process.argv[3] ?? 1);
const api = process.env.APP_API_URL ?? 'http://localhost:3001';
const mapping = (await (await fetch(`${api}/channels/channex/mapping`)).json()) as Array<{
  localAccommodationTypeCode: string | null;
  providerPropertyId: string;
  providerRoomTypeId: string | null;
  providerRatePlanId: string | null;
}>;
const m = mapping.find((x) => x.localAccommodationTypeCode === category);
if (!m?.providerRoomTypeId || !m.providerRatePlanId)
  throw new Error(`Нет маппинга для ${category}`);

const plus = (n: number) =>
  new Date(Date.now() + (n * 24 + 5) * 3600 * 1000).toISOString().slice(0, 10);
const arrival = plus(12);
const departure = plus(12 + nights);
const days: Record<string, string> = {};
for (let i = 0; i < nights; i += 1) days[plus(12 + i)] = '9000.00';
const code = `WH-${Date.now().toString(36).toUpperCase()}`;

const client = new channex.ChannexClient({ apiKey, baseUrl });
const res = await client.request<{ data: { id: string; attributes: Record<string, unknown> } }>(
  'POST',
  '/bookings',
  {
    booking: {
      property_id: m.providerPropertyId,
      ota_reservation_code: code,
      ota_name: 'Offline',
      arrival_date: arrival,
      departure_date: departure,
      currency: 'KZT',
      payment_collect: 'property',
      payment_type: 'bank_transfer',
      notes: 'тест webhook PMS',
      customer: {
        name: 'Гость',
        surname: 'Тест-Webhook',
        mail: 'webhook@example.invalid',
        phone: '+70000000009',
        country: 'KZ',
      },
      rooms: [
        {
          room_type_id: m.providerRoomTypeId,
          rate_plan_id: m.providerRatePlanId,
          days,
          guests: [{ name: 'Гость', surname: 'Тест-Webhook' }],
          occupancy: { adults: 1, children: 0, infants: 0 },
        },
      ],
    },
  },
);
console.log(
  `создана тестовая бронь ${code}: booking ${res.data.id}, unique_id ${String(res.data.attributes['unique_id'])}, revision ${String(res.data.attributes['revision_id'])}, ${arrival} → ${departure}, ${category}`,
);
