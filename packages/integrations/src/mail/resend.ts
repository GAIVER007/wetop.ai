/**
 * Отправка писем учётных записей через Resend (DATA_MODEL §13 шаг 1, ADR-046, решение владельца 15.09.2026).
 * Форма запроса и ответа — `docs/mail/README.md`; живой отправки не было, ключ вписывает владелец.
 *
 * Ключ живёт только в заголовке запроса и никогда не попадает в текст ошибки. Адрес получателя тоже: почта
 * сотрудника — персональные данные (ADR-018), а ошибки уходят в журнал и на экран.
 */
const ENDPOINT = 'https://api.resend.com/emails';

export interface MailConfig {
  apiKey: string;
  from: string;
}

export interface Letter {
  to: string;
  subject: string;
  text: string;
}

export class MailApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'MailApiError';
  }
}

/** Отправки нет, пока владелец не вписал ключ — это не ошибка запуска, а обычное состояние до настройки. */
export function mailConfigFromEnv(env: Record<string, string | undefined>): MailConfig | null {
  const apiKey = env['RESEND_API_KEY']?.trim();
  if (!apiKey) return null;
  return { apiKey, from: env['MAIL_FROM']?.trim() || 'WETOP <no-reply@wetop.ai>' };
}

export class ResendMailer {
  private readonly fetchImpl: typeof fetch;
  constructor(private readonly config: MailConfig & { fetch?: typeof fetch }) {
    this.fetchImpl = config.fetch ?? fetch;
  }

  async send(letter: Letter): Promise<{ id: string }> {
    let response: Response;
    try {
      response = await this.fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.config.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: this.config.from,
          to: [letter.to],
          subject: letter.subject,
          text: letter.text,
        }),
      });
    } catch {
      throw new MailApiError(0, 'письмо не отправлено: сервис отправки не ответил');
    }

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const body = (await response.json()) as { message?: string; name?: string };
        if (body.message) detail = `${detail}: ${body.message}`;
      } catch {
        /* тело не JSON — хватит кода ответа */
      }
      throw new MailApiError(response.status, `письмо не отправлено (${detail})`);
    }

    const body = (await response.json().catch(() => ({}))) as { id?: string };
    return { id: body.id ?? '' };
  }
}
