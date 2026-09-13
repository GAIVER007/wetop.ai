/**
 * Где взять TELEGRAM_CHAT_ID (docs/telegram/README.md). Программа читает TELEGRAM_BOT_TOKEN из .env, спрашивает у
 * Telegram последние обновления бота и печатает чаты, которые он видит: номер, тип, название. Токен и текст
 * сообщений не печатаются.
 *
 *   npm run telegram:chats
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { telegram } from '@pms/integrations';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
if (!token) {
  console.log('TELEGRAM_BOT_TOKEN не задан в .env — сначала впишите токен от @BotFather');
  process.exit(1);
}
try {
  const chats = telegram.chatsFromUpdates(await telegram.telegramGetUpdates(token));
  if (chats.length === 0) {
    console.log(
      'Бот пока не видит ни одного чата. Добавьте бота в группу и напишите в группе /start@<имя_бота>\n' +
        '(или напишите боту в личку), затем запустите команду ещё раз. Telegram хранит обновления около суток.',
    );
    process.exit(1);
  }
  console.log('Чаты, которые видит бот:');
  for (const c of chats) console.log(`  ${c.id.padEnd(16)} ${c.type.padEnd(11)} ${c.title}`);
  const group = chats.find((c) => c.type === 'group' || c.type === 'supergroup');
  console.log(
    `\nВ .env: TELEGRAM_CHAT_ID=${group?.id ?? chats[0]!.id}` +
      (chats.length > 1 ? '  (несколько чатов — через запятую)' : ''),
  );
} catch (e) {
  console.log(`Не получилось: ${(e as Error).message}`);
  process.exit(1);
}
