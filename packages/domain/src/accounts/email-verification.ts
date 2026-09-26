/**
 * Подтверждение почты при самостоятельной регистрации (решение владельца 20.09.2026).
 *
 * Зачем: до подтверждения человек не входит. Это отсекает регистрацию на чужой адрес и опечатку
 * в своём — учётная запись без живой почты бесполезна, по ней не сбросить пароль.
 *
 * Устройство такое же, как у ссылки на пароль (`reset.ts`): в базе только хеш токена, ссылка
 * одноразовая и с коротким сроком. Срок здесь длиннее суток намеренно: письмо о регистрации часто
 * читают не сразу, а просроченная ссылка означает разговор с владельцем.
 */
export const VERIFY_HOURS = 72;

export type VerifyState = 'active' | 'expired' | 'used';

export function verifyExpiry(from: Date): Date {
  return new Date(from.getTime() + VERIFY_HOURS * 3_600_000);
}

export function verifyState(
  row: { expiresAt: Date; usedAt: Date | null },
  now = new Date(),
): VerifyState {
  if (row.usedAt !== null) return 'used';
  return row.expiresAt.getTime() > now.getTime() ? 'active' : 'expired';
}

export function verifyLink(appUrl: string, token: string): string {
  const base = appUrl.replace(/\/+$/, '');
  return `${base}/login/verify?token=${encodeURIComponent(token).replace(/%20/g, '+')}`;
}

export const VERIFY_PENDING_MESSAGE =
  'Почта не подтверждена. Откройте письмо со ссылкой — или запросите его заново.';
export const VERIFY_BAD_LINK_MESSAGE = 'Ссылка не годится: запросите письмо заново.';
export const VERIFY_EXPIRED_MESSAGE = 'Срок ссылки истёк: запросите письмо заново.';
export const VERIFY_ALREADY_MESSAGE = 'Почта уже подтверждена. Войдите с паролем.';

/**
 * Сколько минут повторный переход по ссылке, подтвердившей почту, ещё впускает без пароля: письмо открывают дважды, а
 * почтовые службы ходят по ссылкам сами (ADR-060). Дольше — просим пароль: до 26.09 ссылка впускала бессрочно, даже
 * после смены пароля и «выйти везде» (аудит 25.09 В-1, 26.09 С-7; ADR-095).
 */
export const VERIFY_REPEAT_MINUTES = 10;

import type { MailText } from './reset';

const SIGNATURE = 'Это письмо отправлено системой, не отвечайте на него.';

export function emailVerificationLetter({
  name,
  link,
}: {
  name: string | null;
  link: string;
}): MailText {
  return {
    subject: 'WETOP: подтвердите почту',
    text: [
      name ? `${name}, здравствуйте.` : 'Здравствуйте.',
      '',
      'Вы завели учётную запись в WETOP. Подтвердите почту по ссылке — после этого вход откроется:',
      link,
      '',
      `Ссылка работает ${VERIFY_HOURS} часа и только один раз. Если учётную запись заводили не вы —`,
      'не переходите по ссылке: без подтверждения учётная запись не работает.',
      '',
      SIGNATURE,
    ].join('\n'),
  };
}
