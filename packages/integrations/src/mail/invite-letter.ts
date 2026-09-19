/**
 * Письмо-приглашение в организацию (срез 13, этап 7).
 *
 * Отличия от письма с кодом — намеренные:
 * 1. Ссылка есть: приглашение и есть ссылка (DATA_MODEL §13.6, `token_hash` — «хеш ссылки»).
 *    Поэтому в письме прямо сказано, что делать, если его не ждали, — не открывать.
 * 2. Название организации есть: человек должен понимать, кто его зовёт. Это данные приглашающего,
 *    а не адресата, — по чужой почте о человеке здесь ничего не узнать.
 * 3. Кода для входа нет: он придёт отдельным письмом после принятия, тем же путём, что и всем.
 *
 * Срок и ссылка приходят снаружи: этот слой домена не знает (ADR-004).
 */

import type { MailMessage } from './sender';

export const INVITE_SUBJECT = 'Приглашение в WETOP';

/** «день / дня / дней» — руками, как `minutesWord`. */
export function daysWord(n: number): string {
  const tail = n % 100;
  if (tail >= 11 && tail <= 14) return 'дней';
  switch (n % 10) {
    case 1:
      return 'день';
    case 2:
    case 3:
    case 4:
      return 'дня';
    default:
      return 'дней';
  }
}

export function inviteLetter(
  to: string,
  organizationName: string,
  link: string,
  ttlMs: number,
): MailMessage {
  const d = Math.max(1, Math.round(ttlMs / 86_400_000));
  const text = [
    `Вас приглашают в организацию «${organizationName}» в WETOP.`,
    '',
    'Чтобы принять приглашение, откройте ссылку:',
    link,
    '',
    `Ссылка действует ${d} ${daysWord(d)} и подходит один раз. После принятия на эту почту придёт код для входа.`,
    '',
    'Если вы не ждали приглашения — не открывайте ссылку и просто не отвечайте на это письмо.',
    '',
    'WETOP',
  ].join('\n');
  return { to, subject: INVITE_SUBJECT, text };
}
