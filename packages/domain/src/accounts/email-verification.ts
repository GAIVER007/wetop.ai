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

/**
 * Сколько повторный заход по УЖЕ использованной ссылке ещё впускает (ТЗ аудита 25.09.2026, В-1).
 * Нужен, потому что почтовые клиенты ходят по ссылкам сами: первый «переход» делает антиспам, а через
 * секунды кликает человек. Дольше окна использованная ссылка — не вход: письмо лежит в ящике годами,
 * и вечная ссылка превращала бы доступ к ящику в бессрочный обход пароля.
 */
export const VERIFY_REUSE_WINDOW_MS = 10 * 60_000;

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

/**
 * Код из письма (решение владельца 22.10.2026: «код вместо ссылки, ссылку оставить в том же письме как запасной
 * вариант»). Вход по коду при обычном входе не возвращается: ADR-053 в силе, код только подтверждает почту при
 * регистрации. Шесть цифр и 15 минут: код вводят сразу, пока окно регистрации открыто. Пять неверных попыток гасят
 * код навсегда, а не на время, иначе перебор миллиона вариантов растягивается, но не исключается.
 */
export const VERIFY_CODE_DIGITS = 6;
export const VERIFY_CODE_MINUTES = 15;
export const VERIFY_CODE_MAX_ATTEMPTS = 5;

/** Ровно шесть цифр после снятия пробелов и дефисов: «123 456» и «123-456» из письма принимаются. */
export function normalizeVerificationCode(raw: string): string | null {
  const value = raw.replace(/[\s-]/g, '');
  return new RegExp(`^\\d{${VERIFY_CODE_DIGITS}}$`).test(value) ? value : null;
}

export function verifyCodeExpiry(from: Date): Date {
  return new Date(from.getTime() + VERIFY_CODE_MINUTES * 60_000);
}

/**
 * Что хранится в базе вместо кода. Код короткий, поэтому отпечаток привязан к человеку: одинаковые коды двух людей
 * дают разные строки, и уникальный индекс `token_hash` не ловит чужое совпадение. Префикс отделяет коды от ссылок.
 */
export function verificationCodeKey(userId: string, code: string): string {
  return `email-code:${userId}:${code}`;
}

export const VERIFY_CODE_BAD_MESSAGE = 'Код не подошёл. Проверьте цифры или запросите новый код.';
export const VERIFY_CODE_EXPIRED_MESSAGE = 'Срок кода истёк. Запросите новый код.';
export const VERIFY_CODE_LOCKED_MESSAGE = 'Слишком много неверных попыток. Запросите новый код.';

export const VERIFY_PENDING_MESSAGE =
  'Почта не подтверждена. Откройте письмо со ссылкой — или запросите его заново.';
export const VERIFY_BAD_LINK_MESSAGE = 'Ссылка не годится: запросите письмо заново.';
export const VERIFY_EXPIRED_MESSAGE = 'Срок ссылки истёк: запросите письмо заново.';
export const VERIFY_ALREADY_MESSAGE = 'Почта уже подтверждена: войдите с почтой и паролем.';

import type { MailText } from './reset';

const SIGNATURE = 'Это письмо отправлено системой, не отвечайте на него.';

export function emailVerificationLetter({
  name,
  link,
  code,
}: {
  name: string | null;
  link: string;
  /** Без кода письмо прежнее: только ссылка. */
  code?: string | null;
}): MailText {
  const greeting = name ? `${name}, здравствуйте.` : 'Здравствуйте.';
  const warning = [
    // фразу «не переходите по ссылке» держит проверка аудита 26.09, С-8 (auth.service.test.ts)
    'Если учётную запись заводили не вы, не вводите код и не переходите по ссылке:',
    'без подтверждения учётная запись не работает.',
  ];
  if (!code) {
    return {
      subject: 'WETOP: подтвердите почту',
      text: [
        greeting,
        '',
        'Вы завели учётную запись в WETOP. Подтвердите почту по ссылке, после этого вход откроется:',
        link,
        '',
        `Ссылка работает ${VERIFY_HOURS} часа и только один раз.`,
        ...warning,
        '',
        SIGNATURE,
      ].join('\n'),
    };
  }
  return {
    // Код в теме виден в уведомлении телефона: человек вводит его, не открывая письмо
    subject: `WETOP: код подтверждения ${code}`,
    text: [
      greeting,
      '',
      'Вы завели учётную запись в WETOP. Введите этот код в окне регистрации:',
      '',
      `    ${code}`,
      '',
      `Код действует ${VERIFY_CODE_MINUTES} минут.`,
      '',
      'Окно уже закрыли? Подтвердите почту по ссылке:',
      link,
      `Ссылка работает ${VERIFY_HOURS} часа и только один раз.`,
      '',
      ...warning,
      '',
      SIGNATURE,
    ].join('\n'),
  };
}
