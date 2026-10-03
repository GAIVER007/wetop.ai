/**
 * Сверка смены в ноль: брони, деньги, остатки по ночам (двойная смена, plans/double-shift-2026-10-06.md).
 *
 * Запускается в контейнере API, обычно обёрткой scripts/ops/shift-check.sh:
 *   docker compose … exec -T -w /app api node --import tsx scripts/reconciliation/src/cli-shift-check.ts \
 *     [--date ГГГГ-ММ-ДД] [--from ЧЧ:ММ] [--to ЧЧ:ММ] [--nights 30]
 * На входе (stdin): таблица смены (копия из Google Таблицы или CSV), затем строка `#=== журнал расхождений ===` и
 * журнал как есть (может быть пустым). Выход: в stdout строки для дописывания в журнал, в stderr сводка.
 * Код выхода: 0 в ноль, 1 расхождения, 2 ошибка запуска, 3 расхождений нет, но сверено не всё.
 *
 * Только чтение. WETOP: служебный ключ SERVICE_API_KEY из окружения контейнера. Channex: CHANNEX_API_KEY, как у
 * cli-channex-ari.ts; брони читаются списком только для сверки, приём броней по-прежнему лентой и webhook.
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { channex } from '@pms/integrations';
import { serviceFetch } from '../../lib/service-api';
import { checkShift, parseShiftTable, type ChannexBookingRow } from './shift-check';
import { gatherShift, localStamp, type ApiGet, type ChannexSource } from './shift-check-sources';

export const LOG_MARKER = '#=== журнал расхождений ===';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const API = process.env.APP_API_URL ?? 'http://127.0.0.1:3001';
const TZ = process.env.SHIFT_TZ ?? 'Asia/Almaty';

function fail(message: string): never {
  process.stderr.write(`shift-check: ${message}\n`);
  process.exit(2);
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i < 0) return undefined;
  const v = process.argv[i + 1];
  if (v === undefined || v.startsWith('--')) fail(`после ${name} нужно значение`);
  return v;
}

const now = new Date();
const today = localStamp(now, TZ);
const date = arg('--date') ?? today.slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)))
  fail('дата: нужно ГГГГ-ММ-ДД');
const from = arg('--from') ?? '00:00';
const to = arg('--to') ?? (date === today.slice(0, 10) ? today.slice(11, 16) : '23:59');
for (const t of [from, to])
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) fail(`время ${t}: нужно ЧЧ:ММ`);
if (from > to) fail(`окно ${from}–${to}: начало позже конца`);
const nights = Number(arg('--nights') ?? 30);
if (!Number.isInteger(nights) || nights < 1 || nights > 62) fail('--nights: целое от 1 до 62');

let input = '';
for await (const chunk of process.stdin) input += String(chunk);
const at = input.indexOf(LOG_MARKER);
const tableText = at < 0 ? input : input.slice(0, at);
const logText = at < 0 ? '' : input.slice(at + LOG_MARKER.length).replace(/^\r?\n/, '');
if (!tableText.trim()) fail('таблица смены пустая');
const table = parseShiftTable(tableText, Number(date.slice(0, 4)));

const get: ApiGet = async <T>(path: string) => {
  const res = await serviceFetch(`${API}${path}`, { signal: AbortSignal.timeout(60_000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${path.split('?')[0]}: HTTP ${res.status}`);
  return (await res.json()) as T;
};

function channexSource(): ChannexSource | { unavailable: string } {
  const apiKey = process.env.CHANNEX_API_KEY?.trim();
  if (!apiKey) return { unavailable: 'нет CHANNEX_API_KEY в окружении API' };
  const baseUrl = process.env.CHANNEX_API_BASE_URL?.trim();
  const client = new channex.ChannexClient({
    ...(baseUrl ? { apiKey, baseUrl } : { apiKey }),
    allowProduction: channex.channexProductionAllowed(),
  });
  return {
    availability: (propertyId, fromDay, toDay) =>
      client.getAvailability(propertyId, fromDay, toDay),
    async bookings(propertyId, departureFrom) {
      // Список броней только для сверки; приём броней в WETOP идёт лентой и webhook (сценарий 11 сертификации)
      const list = await client.listAll<{
        property_id: string;
        unique_id: string;
        ota_reservation_code: string | null;
        ota_name: string | null;
        status: 'new' | 'modified' | 'cancelled';
        arrival_date: string;
        departure_date: string;
      }>('/bookings', {
        'filter[property_id]': propertyId,
        'filter[departure_date][gte]': departureFrom,
      });
      // Из ответа берутся только номер, канал, статус и даты: гость и данные карты (guarantee) не читаются
      return list
        .map((b) => b.attributes)
        .filter((a) => a.property_id === propertyId && a.departure_date >= departureFrom)
        .map((a): ChannexBookingRow => ({
          uniqueId: a.unique_id,
          otaCode: a.ota_reservation_code ?? '',
          otaName: a.ota_name ?? '',
          status: a.status,
          arrival: a.arrival_date,
          departure: a.departure_date,
        }));
    },
  };
}

try {
  const snapshot = await gatherShift(
    table.rows,
    { date, from, to, now, nights, timeZone: TZ },
    get,
    channexSource(),
  );
  const result = checkShift({ table, snapshot, logText, now });
  process.stderr.write(`${result.summary}\n`);
  // Выход только после того, как строки журнала ушли в канал: обёртка дописывает их в файл
  process.stdout.write(result.csv, () => process.exit(result.exitCode));
} catch (e) {
  fail(`сверка не выполнена: ${(e as Error).message}`);
}
