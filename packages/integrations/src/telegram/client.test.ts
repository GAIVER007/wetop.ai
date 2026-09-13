import { describe, expect, it } from 'vitest';
import { TelegramApiError, TelegramClient, telegramConfigFromEnv } from './client';

/** Будильник сторожа (срез 11). Форма запросов и ответов — docs/telegram/README.md. */
type Call = { url: string; init: RequestInit };
function fakeFetch(handler: (call: Call, n: number) => { status: number; body: unknown }) {
  const calls: Call[] = [];
  const fn: typeof fetch = async (input, init) => {
    const call = { url: String(input), init: init ?? {} };
    calls.push(call);
    const r = handler(call, calls.length);
    return new Response(JSON.stringify(r.body), {
      status: r.status,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fn, calls };
}
const TOKEN = ['123456', 'fake-bot-token-for-tests'].join(':');
const waits: number[] = [];
const sleep = async (ms: number) => void waits.push(ms);

describe('TelegramClient', () => {
  it('sendMessage: POST JSON на /bot<токен>/sendMessage, каждому чату отдельно, без разметки', async () => {
    const f = fakeFetch(() => ({ status: 200, body: { ok: true, result: { message_id: 1 } } }));
    const c = new TelegramClient({ token: TOKEN, chatIds: ['111', '-222'], fetch: f.fn, sleep });
    const r = await c.sendMessage('🔴 Продано сверх вместимости');
    expect(r).toEqual({ delivered: 2, failed: [] });
    expect(f.calls.map((x) => x.url)).toEqual([
      `https://api.telegram.org/bot${TOKEN}/sendMessage`,
      `https://api.telegram.org/bot${TOKEN}/sendMessage`,
    ]);
    const body = JSON.parse(String(f.calls[0]!.init.body));
    expect(body).toEqual({ chat_id: '111', text: '🔴 Продано сверх вместимости' });
    expect(f.calls[0]!.init.method).toBe('POST');
  });

  it('429 — ждёт retry_after и повторяет один раз', async () => {
    waits.length = 0;
    const f = fakeFetch((_, n) =>
      n === 1
        ? {
            status: 429,
            body: {
              ok: false,
              error_code: 429,
              description: 'Too Many Requests',
              parameters: { retry_after: 3 },
            },
          }
        : { status: 200, body: { ok: true, result: {} } },
    );
    const c = new TelegramClient({ token: TOKEN, chatIds: ['111'], fetch: f.fn, sleep });
    expect(await c.sendMessage('x')).toEqual({ delivered: 1, failed: [] });
    expect(waits).toEqual([3000]);
  });

  it('отказ одному чату не мешает другим; в тексте ошибки нет токена', async () => {
    const f = fakeFetch((call) =>
      String(call.init.body).includes('"111"')
        ? {
            status: 403,
            body: {
              ok: false,
              error_code: 403,
              description: "Forbidden: bot can't initiate conversation with a user",
            },
          }
        : { status: 200, body: { ok: true, result: {} } },
    );
    const c = new TelegramClient({ token: TOKEN, chatIds: ['111', '333'], fetch: f.fn, sleep });
    const r = await c.sendMessage('x');
    expect(r.delivered).toBe(1);
    expect(r.failed).toEqual([
      { chatId: '111', error: "HTTP 403: Forbidden: bot can't initiate conversation with a user" },
    ]);
    expect(JSON.stringify(r)).not.toContain(TOKEN);
  });

  it('текст длиннее 4096 символов обрезается, пустой — ошибка', async () => {
    const f = fakeFetch(() => ({ status: 200, body: { ok: true, result: {} } }));
    const c = new TelegramClient({ token: TOKEN, chatIds: ['1'], fetch: f.fn, sleep });
    await c.sendMessage('я'.repeat(5000));
    expect(JSON.parse(String(f.calls[0]!.init.body)).text.length).toBe(4096);
    await expect(c.sendMessage('   ')).rejects.toBeInstanceOf(TelegramApiError);
  });

  it('сеть недоступна — ошибка с понятным текстом, без токена', async () => {
    const fn: typeof fetch = async () => {
      throw new TypeError(`fetch failed for https://api.telegram.org/bot${TOKEN}/sendMessage`);
    };
    const c = new TelegramClient({ token: TOKEN, chatIds: ['1'], fetch: fn, sleep });
    const r = await c.sendMessage('x');
    expect(r.failed[0]!.error).toMatch(/^сеть — /);
    expect(r.failed[0]!.error).not.toContain(TOKEN);
  });
});

describe('telegramConfigFromEnv', () => {
  it('нет токена или чата — будильник не настроен (null), чаты через запятую', () => {
    expect(telegramConfigFromEnv({})).toBeNull();
    expect(telegramConfigFromEnv({ TELEGRAM_BOT_TOKEN: TOKEN })).toBeNull();
    expect(
      telegramConfigFromEnv({ TELEGRAM_BOT_TOKEN: ` ${TOKEN} `, TELEGRAM_CHAT_ID: '111, -222 ,' }),
    ).toEqual({
      token: TOKEN,
      chatIds: ['111', '-222'],
    });
  });
});
