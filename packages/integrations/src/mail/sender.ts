/**
 * Порт отправки почты. Здесь нет ни одного вендора: конкретный отправитель (срез 13, ADR-046)
 * выбирается владельцем и подключается отдельным файлом рядом. До этого работает заглушка.
 *
 * Ключ отправителя живёт только в переменной окружения и никогда не попадает ни в текст ошибки,
 * ни в журнал (SECURITY.md §3, AGENTS.md §7).
 */

export interface MailMessage {
  /** Адрес получателя. Уже приведён к нижнему регистру доменным слоем. */
  to: string;
  subject: string;
  /** Простой текст. HTML не шлём: письмо с кодом должно читаться везде и нигде не выглядеть подделкой. */
  text: string;
}

export interface MailSender {
  send(message: MailMessage): Promise<void>;
}

export class MailError extends Error {
  constructor(
    message: string,
    readonly retriable: boolean,
  ) {
    super(message);
    this.name = 'MailError';
  }
}

export interface MailConfig {
  provider: string;
  apiKey: string;
  from: string;
  fromName: string;
}

/**
 * Пустая строка в `.env` — это не «значение по умолчанию», а недонастроенное окружение.
 * `??` на пустую строку не срабатывает, на этом уже обожглись с `APP_API_URL`
 * (`reports/wetop-domain-2026-09-15.md` §6.1). Поэтому проверяем именно непустоту.
 */
export function mailConfigFromEnv(env: Record<string, string | undefined>): MailConfig | null {
  const provider = env.MAIL_PROVIDER?.trim();
  const apiKey = env.MAIL_API_KEY?.trim();
  const from = env.MAIL_FROM?.trim();
  const fromName = env.MAIL_FROM_NAME?.trim();
  if (!provider || !apiKey || !from) return null;
  return { provider, apiKey, from, fromName: fromName || 'WETOP' };
}

/** Что показать человеку, если письмо не ушло. Причину наружу не раскрываем. */
export const MAIL_UNAVAILABLE_MESSAGE = 'Не удалось отправить письмо. Попробуйте ещё раз через минуту.';
