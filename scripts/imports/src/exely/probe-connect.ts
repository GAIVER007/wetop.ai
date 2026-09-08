/**
 * Проверка доступа к Exely Connect (только чтение) тем же клиентом, что и импорт.
 * Запуск: `npx tsx scripts/imports/src/exely/probe-connect.ts`
 * Ключи читает программа из .env; в вывод — только статусы и количества.
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { exely } from '@pms/integrations';

loadEnv({ path: resolve(import.meta.dirname, '../../../../.env'), quiet: true });
const clientId = process.env.EXELY_CLIENT_ID ?? '';
const clientSecret = process.env.EXELY_CLIENT_SECRET ?? '';
const propertyId = process.env.EXELY_PROPERTY_ID ?? '';
console.log(
  `env: client_id ${clientId ? 'задан' : 'ПУСТО'}, client_secret ${clientSecret ? 'задан' : 'ПУСТО'}, property_id ${propertyId || 'ПУСТО'}`,
);
if (!clientId || !clientSecret || !propertyId) process.exit(2);

const client = new exely.ExelyConnectClient({ clientId, clientSecret, propertyId, maxRetries: 1 });
try {
  const rooms = await client.listRooms();
  console.log(`rooms: OK, единиц ${rooms.length}; поля: ${Object.keys(rooms[0] ?? {}).join(', ')}`);
  const occ = await client.dailyOccupancy('2026-08-01', '2026-08-31');
  const sum = occ.dailyOccupancies.reduce((a, d) => a + (d.occupancyRoomCount ?? 0), 0);
  console.log(
    `daily-occupancy август: дней ${occ.dailyOccupancies.length}, propertyRoomCount ${occ.propertyRoomCount}, сумма occupancyRoomCount ${sum} (контроль Gate 2: 2174)`,
  );
} catch (e) {
  const err = e as exely.ExelyApiError;
  console.log(`ошибка: ${err.message}${err.requestId ? ` [x-request-id ${err.requestId}]` : ''}`);
  process.exit(1);
}
