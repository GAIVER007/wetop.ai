/**
 * Проверка секретов в .env без вывода значений (SECURITY.md §3): задан ли, длина, остались ли `X` из шаблона,
 * пробелы/кавычки; для PII_ENCRYPTION_KEY — пробное шифрование и расшифровка.
 * Запуск: npx tsx scripts/imports/src/cli-check-env.ts
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { decryptPii, encryptPii, pseudonymSalt, realPiiAllowed } from '@pms/shared';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });

let problems = 0;
for (const name of [
  'DATABASE_URL',
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
// Псевдонимы гостей и режим хранения ПД (ADR-009, ADR-018) — значения не печатаются
try {
  const salt = pseudonymSalt();
  const source = process.env['ANONYMIZE_SALT'] ? 'ANONYMIZE_SALT' : 'PII_ENCRYPTION_KEY (запасной)';
  console.log(`Соль псевдонимов: ${source}, длина ${salt.length}`);
} catch (e) {
  console.log(`Соль псевдонимов: ${(e as Error).message}`);
  problems += 1;
}
if (realPiiAllowed()) {
  console.log(
    'PII_STORAGE=real — в базу пойдут НАСТОЯЩИЕ ФИО и телефоны. Допустимо только для production-БД в РК (Q-070)',
  );
} else {
  console.log('PII_STORAGE: не задан — гости каналов записываются псевдонимами (ADR-018)');
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
// Будильник сторожа (срез 11, docs/telegram/README.md) — необязателен: без него сторож пишет, но не будит
{
  const token = process.env['TELEGRAM_BOT_TOKEN']?.trim();
  const chats = (process.env['TELEGRAM_CHAT_ID'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!token && chats.length === 0) {
    console.log(
      'Будильник Telegram: не настроен — сторож записывает неисправности, но никого не будит',
    );
  } else {
    const tokenOk = !!token && /^\d+:[\w-]{20,}$/.test(token);
    const chatsOk = chats.length > 0 && chats.every((id) => /^-?\d+$/.test(id));
    const tokenText = !token
      ? 'НЕ ЗАДАН'
      : tokenOk
        ? `задан, длина ${token.length}`
        : 'задан, НЕ ПОХОЖ на токен (цифры:буквы, без пробелов и кавычек)';
    const chatText = !chats.length
      ? 'НЕ ЗАДАН — номер покажет npm run telegram:chats'
      : chatsOk
        ? `задан, чатов ${chats.length}${chats.some((id) => id.startsWith('-')) ? ' (есть группа)' : ''}`
        : 'задан, НЕ ЧИСЛО — номер покажет npm run telegram:chats';
    console.log(`TELEGRAM_BOT_TOKEN: ${tokenText}`);
    console.log(`TELEGRAM_CHAT_ID: ${chatText}`);
    if (!tokenOk || !chatsOk) problems += 1;
  }
  const flags = ['GUARD', 'GUARD_AUTOFIX', 'GUARD_PROPERTY_LIVE'].map(
    (f) => `${f}=${process.env[f] ?? '(по умолчанию)'}`,
  );
  console.log(`Сторож: ${flags.join(', ')}`);
  // Сигнал на сервер «сторож сторожа» (plans/slice-12-guard-server.md): адрес не секрет, секрет — только длина
  const beatUrl = process.env['GUARD_HEARTBEAT_URL']?.trim();
  const beatSecret = process.env['GUARD_HEARTBEAT_SECRET']?.trim();
  if (!beatUrl && !beatSecret) {
    console.log('Сигнал на сервер сторожа: не настроен — если Mac замолчит, никто не узнает');
  } else {
    const urlOk = !!beatUrl && /^https:\/\/.+\/heartbeat$/.test(beatUrl);
    const secretOk = !!beatSecret && beatSecret.length >= 32 && !/\s/.test(beatSecret);
    console.log(
      `GUARD_HEARTBEAT_URL: ${beatUrl ? (urlOk ? beatUrl : `${beatUrl} — нужен https://…/heartbeat`) : 'НЕ ЗАДАН'}`,
    );
    console.log(
      `GUARD_HEARTBEAT_SECRET: ${beatSecret ? (secretOk ? `задан, длина ${beatSecret.length}` : 'задан, КОРОЧЕ 32 знаков или с пробелами') : 'НЕ ЗАДАН'}`,
    );
    if (!urlOk || !secretOk) problems += 1;
  }
}
console.log(problems ? `Проблем: ${problems}` : 'Всё на месте.');
process.exitCode = problems ? 1 : 0;
