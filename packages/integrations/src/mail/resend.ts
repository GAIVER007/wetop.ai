/**
 * Resend — отправка письма. Документация: docs/mail/resend-api.md
 * (снято с resend.com/docs 16.09.2026, AGENTS.md §5).
 *
 * Ключ уходит только в заголовок запроса. В текст ошибки он не попадает никогда: ошибки
 * доходят до журнала и до экрана, а туда ключам нельзя (SECURITY.md §3, AGENTS.md §7).
 * Подстраховка на случай, если Resend вернёт ключ или адрес почты в своём сообщении, — `scrub`.
 */

import { MailError, type MailConfig, type MailMessage, type MailSender } from './sender';

const BASE = 'https://api.resend.com';
const TIMEOUT_MS = 10_000;
/** Дольше ждать смысла нет: человек стоит перед формой и ждёт код. */
const RETRY_AFTER_MS = 1_000;

/** Коды, после которых повтор имеет смысл (docs/mail/resend-api.md, раздел «Ошибки»). */
function retriable(status: number): boolean {
  return status === 429 || status === 500 || status === 503;
}

interface ResendError {
  name?: string;
  message?: string;
}

export interface ResendOptions {
  config: MailConfig;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /**
   * Ключ идемпотентности: одинаковый в течение суток не создаёт второго письма. Нужен, чтобы
   * повтор после сетевого сбоя не прислал человеку два разных кода.
   */
  idempotencyKey?: (message: MailMessage) => string | undefined;
}

export class ResendMailSender implements MailSender {
  private readonly fetchFn: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly opts: ResendOptions) {
    this.fetchFn = opts.fetch ?? fetch;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /** `Имя <адрес>` — Resend понимает такой вид отправителя. */
  private get from(): string {
    const { from, fromName } = this.opts.config;
    return fromName ? `${fromName} <${from}>` : from;
  }

  async send(message: MailMessage): Promise<void> {
    await this.attempt(message, false);
  }

  private async attempt(message: MailMessage, retried: boolean): Promise<void> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      authorization: `Bearer ${this.opts.config.apiKey}`,
    };
    const key = this.opts.idempotencyKey?.(message);
    if (key) headers['idempotency-key'] = key;

    let res: Response;
    try {
      res = await this.fetchFn(`${BASE}/emails`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          from: this.from,
          to: message.to,
          subject: message.subject,
          text: message.text,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      // Сеть не ответила. Отличить «не дошло» от «дошло, но ответ потерялся» нельзя,
      // поэтому повтор безопасен только с ключом идемпотентности — он у нас есть.
      throw new MailError(this.scrub(`сеть — ${(e as Error).message}`), true);
    }

    if (res.ok) return;

    if (retriable(res.status) && !retried) {
      await this.sleep(RETRY_AFTER_MS);
      return this.attempt(message, true);
    }

    const body = (await res.json().catch(() => ({}))) as ResendError;
    const what = body.name ?? 'без имени';
    throw new MailError(
      this.scrub(`Resend HTTP ${res.status} (${what}): ${body.message ?? 'без описания'}`),
      retriable(res.status),
    );
  }

  /**
   * Текст ошибки уходит в журнал API и на экран: без ключа и без адресов почты. Адрес — персональные данные
   * (SECURITY.md §11), а своё сообщение Resend пишет как хочет и может назвать в нём и получателя, и владельца аккаунта.
   */
  private scrub(message: string): string {
    const key = this.opts.config.apiKey;
    const withoutKey = key ? message.split(key).join('<ключ>') : message;
    return withoutKey.replace(/[^\s<>()[\]"'`,;:@]+@[^\s<>()[\]"'`,;:@]+/g, '<почта>');
  }
}
