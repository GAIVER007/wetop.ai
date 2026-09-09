/**
 * Проверка секретов в .env без вывода значений (SECURITY.md §3): задан ли, длина, остались ли `X` из шаблона,
 * пробелы/кавычки; для PII_ENCRYPTION_KEY — пробное шифрование и расшифровка.
 * Запуск: npx tsx scripts/imports/src/cli-check-env.ts
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { decryptPii, encryptPii } from '@pms/shared';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });

let problems = 0;
for (const name of [
  'DATABASE_URL',
  'EXELY_API_KEY',
  'CHANNEX_API_KEY',
  'CHANNEX_WEBHOOK_SECRET',
  'PII_ENCRYPTION_KEY',
]) {
  const v = process.env[name];
  if (!v) {
    console.log(`${name}: НЕ ЗАДАН`);
    problems += 1;
    continue;
  }
  const facts = [`длина ${v.length}`];
  if (name === 'CHANNEX_WEBHOOK_SECRET' || name === 'PII_ENCRYPTION_KEY') {
    const xs = v.split('X').length - 1;
    facts.push(xs ? `ОСТАЛИСЬ X (${xs} шт.) — заменить` : 'X заменены');
    if (xs) problems += 1;
  }
  if (/\s/.test(v)) {
    facts.push('ЕСТЬ ПРОБЕЛЫ');
    problems += 1;
  }
  if (/["']/.test(v)) facts.push('есть кавычки (dotenv их снимает, но лучше без них)');
  console.log(`${name}: задан, ${facts.join(', ')}`);
}
try {
  const token = encryptPii('проверка 0001');
  const ok = decryptPii(token) === 'проверка 0001';
  console.log(`PII шифрование: ${ok ? 'ок — зашифровал и расшифровал' : 'ОШИБКА расшифровки'}`);
  if (!ok) problems += 1;
} catch (e) {
  console.log(`PII шифрование: ОШИБКА — ${(e as Error).message}`);
  problems += 1;
}
console.log(problems ? `Проблем: ${problems}` : 'Всё на месте.');
process.exitCode = problems ? 1 : 0;
