/**
 * Восстановить календарь цен после тестовых изменений (сертификация Channex): импорт снимка Exely
 * возвращает цены, тестовые ограничения снимаются, затем полная выгрузка в Channex.
 * Запуск (API должен быть запущен на 3001):
 *   npx tsx scripts/reconciliation/src/cli-restore-rates.ts --yes-restore-exely-snapshot
 *
 * Скрипт стирает стоп-продажи и ограничения, поставленные в WETOP, и выгружает снимок в Channex. Поэтому без флага
 * подтверждения и против нелокального API он не делает ни шага (аудит 26.09, С-74).
 */
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { serviceFetch } from '../../lib/service-api';
const ROOT = resolve(import.meta.dirname, '../../..');
// Та же база, куда запишет импорт на шаге 1 (он читает тот же .env); переменные окружения важнее файла
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const API = process.env.APP_API_URL ?? 'http://127.0.0.1:3001';
const CONFIRM = '--yes-restore-exely-snapshot';
if (!process.argv.includes(CONFIRM)) {
  console.error(
    `Отказ: скрипт вернёт цены к снимку Exely от 09.09, снимет стоп-продажи и ограничения за 2026-11-01…2027-05-01 ` +
      `и выгрузит всё в Channex. Если это действительно нужно — запустите с ${CONFIRM}.`,
  );
  process.exit(2);
}
const LOCAL = ['127.0.0.1', 'localhost', '::1', '[::1]'];
const hostOf = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
};
if (!LOCAL.includes(hostOf(API))) {
  console.error(`Отказ: только локальный API (127.0.0.1 или localhost), а задан ${API}.`);
  process.exit(2);
}
// Шаг 1 пишет прямо в базу: локальный API не доказывает, что база не рабочая (проверка исправлений 26.09)
const database = process.env.DATABASE_URL ?? '';
if (!LOCAL.includes(hostOf(database))) {
  console.error(
    `Отказ: база для импорта — только локальная (127.0.0.1 или localhost), а в DATABASE_URL ${hostOf(database) || 'пусто'}.`,
  );
  process.exit(2);
}
console.log('1/3 импорт календаря цен из снимка Exely');
console.log(
  execSync('npx tsx scripts/imports/src/cli-import-price-calendar.ts', {
    cwd: ROOT,
    encoding: 'utf-8',
  }).trim(),
);
console.log('2/3 снятие ограничений за 2026-11-01 … 2027-05-01 (одноместная с окном, двухместная)');
const clear = {
  minStay: null,
  maxStay: null,
  stopSell: false,
  closedToArrival: false,
  closedToDeparture: false,
};
const res = await serviceFetch(`${API}/rates/bulk`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    changes: ['exely-5074312', 'exely-5074687'].map((accommodationTypeCode) => ({
      accommodationTypeCode,
      ratePlanCode: 'exely-10158310',
      dateFrom: '2026-11-01',
      dateTo: '2027-05-01',
      ...clear,
    })),
  }),
});
console.log(res.status, (await res.text()).slice(0, 200));
console.log('3/3 полная выгрузка 500 дней');
const sync = await serviceFetch(`${API}/channels/channex/sync?days=500`, { method: 'POST' });
console.log(sync.status, (await sync.text()).slice(0, 300));
