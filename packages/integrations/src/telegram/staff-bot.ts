/**
 * Бот WETOP для уведомлений сотрудникам о бронях с сайта (STAFF-TG-20261020, план
 * `plans/staff-telegram-notifications-2026-10-20.md`). Документация: docs/telegram/README.md и
 * https://core.telegram.org/bots/api (sendMessage, getMe, InlineKeyboardMarkup, setWebhook с secret_token).
 *
 * Бот один на платформу, отдельно от будильника сторожа (`client.ts`). Токен живёт только в адресе запроса и не
 * попадает ни в текст ошибки, ни в журнал. Разметка (`parse_mode`) не используется: текст простой.
 */
import { TELEGRAM_TEXT_LIMIT } from './client';

const BASE = 'https://api.telegram.org';
const TIMEOUT_MS = 10_000;
/** Алфавит secret_token в setWebhook: 1-256 знаков A-Z, a-z, 0-9, _ и - */
const SECRET_RE = /^[A-Za-z0-9_-]{1,256}$/;

export interface StaffBotConfig {
  token: string;
  /** Секрет вебхука (`X-Telegram-Bot-Api-Secret-Token`); без него вебхук закрыт */
  webhookSecret: string | null;
}

/** Бот подключён, только если администратор платформы вписал токен (SECURITY.md §3) */
export function staffBotConfigFromEnv(env: Record<string, string | undefined>): StaffBotConfig | null {
  const token = env.TELEGRAM_STAFF_BOT_TOKEN?.trim();
  if (!token) return null;
  const secret = env.TELEGRAM_STAFF_WEBHOOK_SECRET?.trim() ?? '';
  return { token, webhookSecret: SECRET_RE.test(secret) ? secret : null };
}

export type StaffSendResult =
  | { ok: true }
  | {
      ok: false;
      /** HTTP-статус Telegram; 0: сеть или таймаут */
      status: number;
      /** 403: сотрудник заблокировал бота или удалил чат, привязку надо отключить */
      blocked: boolean;
      /** 429: сколько секунд подождать */
      retryAfterS?: number;
      /** Описание Telegram без токена, до 200 знаков */
      error: string;
    };

interface TelegramResponse {
  ok: boolean;
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number };
  result?: { username?: string };
}

export class StaffBotClient {
  private readonly fetchFn: typeof fetch;
  private cachedUsername: string | null = null;
  constructor(private readonly opts: { token: string; fetch?: typeof fetch }) {
    this.fetchFn = opts.fetch ?? fetch;
  }

  /** Одно сообщение в личный чат сотрудника, с кнопкой-ссылкой. Ошибки не бросает: решает отправщик */
  async sendMessage(chatId: string, text: string, button?: { text: string; url: string }): Promise<StaffSendResult> {
    if (!text.trim()) return { ok: false, status: 400, blocked: false, error: 'пустое сообщение' };
    const body: Record<string, unknown> = { chat_id: chatId, text: [...text].slice(0, TELEGRAM_TEXT_LIMIT).join('') };
    if (button) body.reply_markup = { inline_keyboard: [[{ text: button.text, url: button.url }]] };
    const res = await this.call('sendMessage', body);
    if ('network' in res) return { ok: false, status: 0, blocked: false, error: res.network };
    if (res.status >= 200 && res.status < 300 && res.json.ok) return { ok: true };
    const status = res.status || res.json.error_code || 0;
    const retry = res.json.parameters?.retry_after;
    return {
      ok: false,
      status,
      blocked: status === 403,
      ...(typeof retry === 'number' && retry > 0 ? { retryAfterS: retry } : {}),
      error: this.hide(res.json.description ?? 'без описания').slice(0, 200),
    };
  }

  /** Имя бота для ссылки `https://t.me/<имя>?start=<код>` (getMe), запоминается на процесс */
  async username(): Promise<string | null> {
    if (this.cachedUsername) return this.cachedUsername;
    const res = await this.call('getMe', {});
    if ('network' in res || !res.json.ok) return null;
    const name = res.json.result?.username;
    if (typeof name !== 'string' || !/^[A-Za-z0-9_]{5,64}$/.test(name)) return null;
    this.cachedUsername = name;
    return name;
  }

  private async call(
    method: string,
    body: Record<string, unknown>,
  ): Promise<{ status: number; json: TelegramResponse } | { network: string }> {
    let res: Response;
    try {
      res = await this.fetchFn(`${BASE}/bot${this.opts.token}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      return { network: this.hide(`сеть: ${(e as Error).message}`).slice(0, 200) };
    }
    const json = (await res.json().catch(() => ({ ok: false }))) as TelegramResponse;
    return { status: res.status, json };
  }

  private hide(message: string): string {
    return message.split(this.opts.token).join('<токен>');
  }
}
