import { mail } from '@pms/integrations';

/**
 * Отправитель писем гостю о брони с сайта (ADR-144). Тот же сервис писем, что у приглашений сотрудникам (Q-142),
 * но без заглушки по умолчанию: не настроена почта — письма гостю просто нет, бронь от этого не страдает.
 */
export const BOOKING_MAILER = Symbol('BOOKING_MAILER');

export function bookingMailerFromEnv(env: NodeJS.ProcessEnv = process.env): mail.MailSender | null {
  const config = mail.mailConfigFromEnv(env);
  return config ? new mail.ResendMailSender({ config }) : null;
}
