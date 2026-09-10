/** Только чтение: неподтверждённые ревизии в ленте Channex (id, статус, unique_id) — без ПД. */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { channex } from '@pms/integrations';
loadEnv({ path: resolve(import.meta.dirname, '../../../.env'), quiet: true });
const apiKey = process.env.CHANNEX_API_KEY?.trim();
if (!apiKey) throw new Error('CHANNEX_API_KEY пуст');
const baseUrl = process.env.CHANNEX_API_BASE_URL?.trim();
const client = new channex.ChannexClient(baseUrl ? { apiKey, baseUrl } : { apiKey });
const feed = await client.bookingRevisionsFeed();
console.log(`в ленте неподтверждённых ревизий: ${feed.length}`);
for (const r of feed)
  console.log(
    `  ${r.id}  ${String(r.attributes.status)}  ${String(r.attributes.unique_id)}  inserted ${String(r.attributes.inserted_at ?? '')}`,
  );
