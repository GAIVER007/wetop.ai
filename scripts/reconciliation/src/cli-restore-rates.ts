/**
 * Восстановить календарь цен после тестовых изменений (сертификация Channex): импорт снимка Exely
 * возвращает цены, тестовые ограничения снимаются, затем полная выгрузка в Channex.
 * Запуск (API должен быть запущен на 3001): npx tsx scripts/reconciliation/src/cli-restore-rates.ts
 */
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dirname, '../../..');
const API = process.env.APP_API_URL ?? 'http://127.0.0.1:3001';
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
const res = await fetch(`${API}/rates/bulk`, {
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
const sync = await fetch(`${API}/channels/channex/sync?days=500`, { method: 'POST' });
console.log(sync.status, (await sync.text()).slice(0, 300));
