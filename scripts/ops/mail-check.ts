/**
 * Контрольное письмо (срез 13, ADR-046). Читает MAIL_* из .env, собирает то же письмо с кодом,
 * которое будет уходить при входе, и отправляет на указанный адрес.
 *
 *   npm run mail:check -- urij@wetop.ai
 *
 * Код в письме — заведомо ненастоящий, шестёрки: программа ничего не заводит в базе и ничего
 * не проверяет, она только доказывает, что письмо доходит. Ключ не печатается ни при успехе,
 * ни при ошибке (SECURITY.md §3).
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { mail } from '@pms/integrations';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });

const to = process.argv[2]?.trim();
if (!to || !to.includes('@')) {
  console.log('Кому слать? Укажите адрес: npm run mail:check -- вы@example.com');
  process.exit(1);
}

const config = mail.mailConfigFromEnv(process.env);
if (!config) {
  console.log(
    'Отправитель не настроен. В .env нужны MAIL_PROVIDER, MAIL_API_KEY и MAIL_FROM\n' +
      '(см. docs/mail/setup-2026-09-16.md §4). Пустая строка считается «не задано».',
  );
  process.exit(1);
}
if (config.provider !== 'resend') {
  console.log(`MAIL_PROVIDER=${config.provider}: другого отправителя пока нет, есть только resend`);
  process.exit(1);
}

// Письмо с кодом для входа снято 20.09.2026 вместе с самим входом по коду (ADR-053). Проверяем
// отправителя приглашением — единственным письмом, которое система теперь шлёт сама.
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const letter = mail.inviteLetter(
  to,
  'Проверка отправителя',
  'https://app.wetop.ai/invite/proverka',
  SEVEN_DAYS,
);
const sender = new mail.ResendMailSender({ config });

console.log(`Отправляю на ${to} с ${config.from}...`);
try {
  await sender.send(letter);
  console.log('Ушло. Проверьте ящик, включая «Спам» — первое письмо с нового домена часто там.');
  console.log('Если письма нет через пару минут — посмотрите Logs в панели Resend.');
} catch (e) {
  const err = e as { message: string; retriable?: boolean };
  console.log(`Не ушло: ${err.message}`);
  console.log(
    err.retriable
      ? 'Это временный отказ — попробуйте ещё раз через минуту.'
      : 'Это не временный отказ: проверьте ключ, права ключа и что домен в Resend подтверждён.',
  );
  process.exit(1);
}
