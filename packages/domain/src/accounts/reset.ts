/**
 * Одноразовая ссылка на установку пароля (DATA_MODEL §13 шаг 1, ADR-046, решение владельца 15.09.2026).
 * Одной и той же дорогой идут два случая: приглашение нового сотрудника и сброс пароля по его просьбе —
 * в базе это одна запись `password_resets`, в письме одна ссылка.
 *
 * В письме нет и не может быть пароля: только ссылка, и только на сутки.
 */
export const RESET_HOURS = 24;

export type ResetState = 'active' | 'expired' | 'used';

export function resetExpiry(from: Date): Date {
  return new Date(from.getTime() + RESET_HOURS * 3_600_000);
}

/** Использованная ссылка не годна и до истечения срока: второй раз по ней пароль не поставить. */
export function resetState(
  row: { expiresAt: Date; usedAt: Date | null },
  now = new Date(),
): ResetState {
  if (row.usedAt !== null) return 'used';
  return row.expiresAt.getTime() > now.getTime() ? 'active' : 'expired';
}

export function resetLink(appUrl: string, token: string): string {
  const base = appUrl.replace(/\/+$/, '');
  return `${base}/login/set-password?token=${encodeURIComponent(token).replace(/%20/g, '+')}`;
}

export interface MailText {
  subject: string;
  text: string;
}

const SIGNATURE = 'Это письмо отправлено системой, не отвечайте на него.';

export function invitationLetter({ fullName, link }: { fullName: string; link: string }): MailText {
  return {
    subject: 'WETOP: задайте пароль для входа',
    text: [
      `${fullName}, здравствуйте.`,
      '',
      'Вам открыли доступ к WETOP — системе управления объектом. Задайте себе пароль по ссылке:',
      link,
      '',
      `Ссылка работает 24 часа и только один раз. Если срок вышел, попросите открыть доступ заново.`,
      '',
      SIGNATURE,
    ].join('\n'),
  };
}

export function passwordResetLetter({ link }: { link: string }): MailText {
  return {
    subject: 'WETOP: смена пароля',
    text: [
      'Здравствуйте.',
      '',
      'Кто-то попросил сменить пароль для входа в WETOP. Если это были вы, задайте новый пароль по ссылке:',
      link,
      '',
      'Ссылка работает 24 часа и только один раз. Если это были не вы — ничего делать не нужно, прежний',
      'пароль остаётся в силе.',
      '',
      SIGNATURE,
    ].join('\n'),
  };
}
