/**
 * Telegram Bot API — только отправка сообщения, для будильника сторожа (срез 11, ADR-028).
 * Документация: docs/telegram/README.md (снято с core.telegram.org/bots/api 13.09.2026).
 *
 * Токен живёт только в адресе запроса и никогда не попадает в текст ошибки: ошибки уходят в таблицу
 * неисправностей и на экран. Разметка (`parse_mode`) не используется — заголовки неисправностей не экранируются.
 */

export const TELEGRAM_TEXT_LIMIT = 4096;
const BASE = 'https://api.telegram.org';
const TIMEOUT_MS = 10_000;
/** Дольше ждать по 429 не будем: сторож пройдёт следующий тик через минуту */
const MAX_RETRY_AFTER_S = 30;

export class TelegramApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'TelegramApiError';
  }
}

export interface TelegramConfig {
  token: string;
  chatIds: string[];
}

export interface TelegramClientOptions extends TelegramConfig {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export interface SendResult {
  delivered: number;
  failed: Array<{ chatId: string; error: string }>;
}

interface TelegramResponse {
  ok: boolean;
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number };
}

/** Будильник настроен, только если владелец вписал и токен, и хотя бы один чат (SECURITY.md §3). */
export function telegramConfigFromEnv(env: Record<string, string | undefined>): TelegramConfig | null {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatIds = (env.TELEGRAM_CHAT_ID ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return token && chatIds.length > 0 ? { token, chatIds } : null;
}

export class TelegramClient {
  private readonly fetchFn: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  constructor(private readonly opts: TelegramClientOptions) {
    this.fetchFn = opts.fetch ?? fetch;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /** Каждому чату отдельно: отказ одному (не запускал бота) не мешает остальным. */
  async sendMessage(text: string): Promise<SendResult> {
    if (!text.trim()) throw new TelegramApiError('пустое сообщение', 400);
    const body = [...text].slice(0, TELEGRAM_TEXT_LIMIT).join('');
    const result: SendResult = { delivered: 0, failed: [] };
    for (const chatId of this.opts.chatIds) {
      try {
        await this.send(chatId, body);
        result.delivered += 1;
      } catch (e) {
        result.failed.push({ chatId, error: this.hideToken((e as Error).message) });
      }
    }
    return result;
  }

  private async send(chatId: string, text: string, retried = false): Promise<void> {
    let res: Response;
    try {
      res = await this.fetchFn(`${BASE}/bot${this.opts.token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      throw new TelegramApiError(`сеть — ${(e as Error).message}`, 0);
    }
    const json = (await res.json().catch(() => ({ ok: false }))) as TelegramResponse;
    if (res.ok && json.ok) return;
    const wait = json.parameters?.retry_after;
    if (res.status === 429 && !retried && wait !== undefined && wait <= MAX_RETRY_AFTER_S) {
      await this.sleep(wait * 1000);
      return this.send(chatId, text, true);
    }
    throw new TelegramApiError(`HTTP ${res.status}: ${json.description ?? 'без описания'}`, res.status);
  }

  private hideToken(message: string): string {
    return message.split(this.opts.token).join('<токен>');
  }
}
