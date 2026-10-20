import { describe, expect, it, vi } from 'vitest';
import { StaffBotClient, staffBotConfigFromEnv } from './staff-bot';

/** Бот уведомлений сотрудникам (STAFF-TG-20261020): отправка и getMe через подставной fetch, без сети */
const TOKEN = '123456:synthetic-staff-token';
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('бот уведомлений сотрудникам', () => {
  it('настроен только с токеном; секрет вебхука отдельно', () => {
    expect(staffBotConfigFromEnv({})).toBeNull();
    expect(staffBotConfigFromEnv({ TELEGRAM_STAFF_BOT_TOKEN: '  ' })).toBeNull();
    expect(staffBotConfigFromEnv({ TELEGRAM_STAFF_BOT_TOKEN: ` ${TOKEN} `, TELEGRAM_STAFF_WEBHOOK_SECRET: ' s3cr-et_ ' })).toEqual({
      token: TOKEN,
      webhookSecret: 's3cr-et_',
    });
    // секрет вне алфавита Telegram (A-Z a-z 0-9 _ -) не принимается: setWebhook его бы отверг
    expect(staffBotConfigFromEnv({ TELEGRAM_STAFF_BOT_TOKEN: TOKEN, TELEGRAM_STAFF_WEBHOOK_SECRET: 'bad secret!' })).toEqual({
      token: TOKEN,
      webhookSecret: null,
    });
  });

  it('sendMessage: личный чат, текст без разметки, кнопка «Открыть в WETOP»', async () => {
    const fetch = vi.fn(async () => json(200, { ok: true, result: { message_id: 1 } }));
    const bot = new StaffBotClient({ token: TOKEN, fetch: fetch as never });
    const r = await bot.sendMessage('4242', 'Новая запись', { text: 'Открыть в WETOP', url: 'https://app.wetop.ai/appointments' });
    expect(r).toEqual({ ok: true });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
    expect(JSON.parse(String(init.body))).toEqual({
      chat_id: '4242',
      text: 'Новая запись',
      reply_markup: { inline_keyboard: [[{ text: 'Открыть в WETOP', url: 'https://app.wetop.ai/appointments' }]] },
    });
  });

  it('403: бот заблокирован; 429: пауза из ответа; сеть: статус 0; токена в ошибке нет', async () => {
    const answers = [
      json(403, { ok: false, error_code: 403, description: `Forbidden: bot was blocked by the user ${TOKEN}` }),
      json(429, { ok: false, error_code: 429, description: 'Too Many Requests', parameters: { retry_after: 17 } }),
    ];
    const fetch = vi.fn(async () => {
      const next = answers.shift();
      if (!next) throw new Error(`connect ECONNREFUSED api.telegram.org/bot${TOKEN}`);
      return next;
    });
    const bot = new StaffBotClient({ token: TOKEN, fetch: fetch as never });
    const blocked = await bot.sendMessage('1', 'x');
    expect(blocked).toMatchObject({ ok: false, status: 403, blocked: true });
    expect(JSON.stringify(blocked)).not.toContain(TOKEN);
    expect(await bot.sendMessage('1', 'x')).toMatchObject({ ok: false, status: 429, retryAfterS: 17, blocked: false });
    const net = await bot.sendMessage('1', 'x');
    expect(net).toMatchObject({ ok: false, status: 0, blocked: false });
    expect(JSON.stringify(net)).not.toContain(TOKEN);
  });

  it('текст длиннее 4096 знаков обрезается, пустой не отправляется', async () => {
    const fetch = vi.fn(async () => json(200, { ok: true }));
    const bot = new StaffBotClient({ token: TOKEN, fetch: fetch as never });
    await bot.sendMessage('1', 'я'.repeat(5000));
    expect([...JSON.parse(String((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body)).text]).toHaveLength(4096);
    expect(await bot.sendMessage('1', '   ')).toMatchObject({ ok: false, status: 400 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('getMe: имя бота для ссылки t.me, запоминается', async () => {
    const fetch = vi.fn(async () => json(200, { ok: true, result: { id: 1, is_bot: true, username: 'wetop_staff_bot' } }));
    const bot = new StaffBotClient({ token: TOKEN, fetch: fetch as never });
    expect(await bot.username()).toBe('wetop_staff_bot');
    expect(await bot.username()).toBe('wetop_staff_bot');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
