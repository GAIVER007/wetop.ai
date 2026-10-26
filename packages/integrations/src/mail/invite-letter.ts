/**
 * Письмо-приглашение в организацию (срез 13, этап 7).
 *
 * Отличия от письма с кодом — намеренные:
 * 1. Ссылка есть: приглашение и есть ссылка (DATA_MODEL §13.6, `token_hash` — «хеш ссылки»).
 *    Поэтому в письме прямо сказано, что делать, если его не ждали, — не открывать.
 * 2. Название организации есть: человек должен понимать, кто его зовёт. Это данные приглашающего,
 *    а не адресата, — по чужой почте о человеке здесь ничего не узнать.
 * 3. Кода для входа нет: после принятия человек сам задаёт себе пароль (ADR-053; вход по коду снят 20.09.2026).
 * 4. Роль названа, если её передали (ADR-107): человек заранее знает, управляющим его зовут или администратором.
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

/** Язык письма: язык организации (ORG-LOCALE-20261026). Без него письмо русское, как раньше */
export type InviteLetterLocale = 'ru' | 'kk' | 'en';

/** Роль кодом базы или готовым словом стойки (до 26.10.2026 сервис передавал слово) */
const ROLE_WORDS: Record<InviteLetterLocale, Record<string, string>> = {
  ru: { MANAGER: 'управляющий', STAFF: 'администратор', EMPLOYEE: 'личный кабинет' },
  kk: { MANAGER: 'басқарушы', STAFF: 'әкімші', EMPLOYEE: 'жеке кабинет' },
  en: { MANAGER: 'manager', STAFF: 'administrator', EMPLOYEE: 'personal account' },
};

export function inviteLetter(
  to: string,
  organizationName: string,
  link: string,
  ttlMs: number,
  /** Роль: код (`STAFF`, `MANAGER`, `EMPLOYEE`) или слово стойки («управляющий») */
  role?: string,
  locale: InviteLetterLocale = 'ru',
): MailMessage {
  const d = Math.max(1, Math.round(ttlMs / 86_400_000));
  const roleWord = role ? (ROLE_WORDS[locale][role] ?? role) : undefined;
  if (locale === 'en') {
    const text = [
      `You are invited to join "${organizationName}" in WETOP.`,
      ...(roleWord ? [`Role: ${roleWord}.`] : []),
      '',
      'To accept the invitation, open this link:',
      link,
      '',
      `The link is valid for ${d} ${d === 1 ? 'day' : 'days'} and works once. After accepting, you will create your own password to sign in.`,
      '',
      'If you did not expect this invitation, do not open the link and simply ignore this email.',
      '',
      'WETOP',
    ].join('\n');
    return { to, subject: 'Invitation to WETOP', text };
  }
  if (locale === 'kk') {
    const text = [
      `Сізді WETOP жүйесіндегі «${organizationName}» ұйымына шақырады.`,
      ...(roleWord ? [`Рөлі: ${roleWord}.`] : []),
      '',
      'Шақыруды қабылдау үшін сілтемені ашыңыз:',
      link,
      '',
      `Сілтеме ${d} күн жарамды және бір рет қана жұмыс істейді. Қабылдағаннан кейін кіру үшін өз құпиясөзіңізді ойлап табасыз.`,
      '',
      'Егер шақыруды күтпеген болсаңыз, сілтемені ашпаңыз және бұл хатқа жауап бермеңіз.',
      '',
      'WETOP',
    ].join('\n');
    return { to, subject: 'WETOP-қа шақыру', text };
  }
  const text = [
    `Вас приглашают в организацию «${organizationName}» в WETOP.`,
    ...(roleWord ? [`Роль: ${roleWord}.`] : []),
    '',
    'Чтобы принять приглашение, откройте ссылку:',
    link,
    '',
    `Ссылка действует ${d} ${daysWord(d)} и подходит один раз. После принятия вы зададите себе пароль для входа.`,
    '',
    'Если вы не ждали приглашения — не открывайте ссылку и просто не отвечайте на это письмо.',
    '',
    'WETOP',
  ].join('\n');
  return { to, subject: INVITE_SUBJECT, text };
}
