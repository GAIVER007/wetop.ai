import { describe, expect, it, vi } from 'vitest';
import {
  TURNSTILE_VERIFY_URL,
  TurnstileService,
  turnstileConfigNotice,
  turnstileFailureError,
} from './turnstile';

/**
 * BOOK-SEC1 (аудит 29.09.2026): публичный `POST /w/book` сразу создаёт подтверждённую бронь; домен сайта проверяется по
 * `Origin`, который вне браузера подделывается. Перед бронью проверяется токен Cloudflare Turnstile: на сервере, секрет
 * только на сервере, любая неопределённость — отказ (fail-closed). Cloudflare в тестах подделан.
 */
const ENV = { TURNSTILE_SECRET_KEY: 'secret-not-real', TURNSTILE_SITE_KEY: 'site-key-not-real' };
const CTX = { ip: '203.0.113.7', allowedHosts: ['hotel.example'], ownHost: 'api.example' };
const OK_BODY = { success: true, hostname: 'hotel.example', action: 'booking', 'error-codes': [] };

const answer = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe('Turnstile: включение и ключи', () => {
  it('без секрета проверка выключена и публичный ключ не отдаётся', () => {
    const t = new TurnstileService(answer(OK_BODY));
    expect(t.enabled({})).toBe(false);
    expect(t.enabled({ TURNSTILE_SECRET_KEY: '   ' })).toBe(false);
    expect(t.siteKey({ TURNSTILE_SITE_KEY: 'site-key-not-real' })).toBeNull();
  });

  it('с секретом проверка включена; публичный ключ отдаётся, секрет — никогда', () => {
    const t = new TurnstileService(answer(OK_BODY));
    expect(t.enabled(ENV)).toBe(true);
    expect(t.siteKey(ENV)).toBe('site-key-not-real');
    expect(JSON.stringify({ k: t.siteKey(ENV) })).not.toContain('secret-not-real');
    // секрет есть, а публичного ключа нет: виджету нечего показывать
    expect(t.siteKey({ TURNSTILE_SECRET_KEY: 'secret-not-real' })).toBeNull();
  });
});

describe('Turnstile: проверка токена у Cloudflare', () => {
  it('успех: запрос к siteverify с секретом, токеном и адресом посетителя', async () => {
    const fetchImpl = answer(OK_BODY);
    const t = new TurnstileService(fetchImpl);
    await expect(t.verify('token-1', CTX, ENV)).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(TURNSTILE_VERIFY_URL);
    expect(init.method).toBe('POST');
    expect(Object.fromEntries(new URLSearchParams(String(init.body)))).toEqual({
      secret: 'secret-not-real',
      response: 'token-1',
      remoteip: '203.0.113.7',
    });
    // Cloudflare не должен ждать вечно
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('адреса нет — remoteip не отправляется', async () => {
    const fetchImpl = answer(OK_BODY);
    await new TurnstileService(fetchImpl).verify('token-1', { ...CTX, ip: null }, ENV);
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(new URLSearchParams(String(init.body)).has('remoteip')).toBe(false);
  });

  it('токена нет, он пуст или не строка — «нет токена», Cloudflare не спрашивается', async () => {
    const fetchImpl = answer(OK_BODY);
    const t = new TurnstileService(fetchImpl);
    for (const token of [undefined, null, '', '   ', 123, {}, []]) {
      await expect(t.verify(token, CTX, ENV)).resolves.toEqual({ ok: false, reason: 'missing' });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('слишком длинный токен — неверный, Cloudflare не спрашивается', async () => {
    const fetchImpl = answer(OK_BODY);
    await expect(
      new TurnstileService(fetchImpl).verify('x'.repeat(2049), CTX, ENV),
    ).resolves.toEqual({ ok: false, reason: 'invalid' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('Cloudflare отвергает токен: неверный, устарел или уже использован, пустой', async () => {
    const codes = (c: string) =>
      new TurnstileService(answer({ success: false, 'error-codes': [c] })).verify('t', CTX, ENV);
    await expect(codes('invalid-input-response')).resolves.toEqual({
      ok: false,
      reason: 'invalid',
    });
    await expect(codes('timeout-or-duplicate')).resolves.toEqual({ ok: false, reason: 'expired' });
    await expect(codes('missing-input-response')).resolves.toEqual({
      ok: false,
      reason: 'missing',
    });
    await expect(codes('something-new')).resolves.toEqual({ ok: false, reason: 'invalid' });
  });

  it('секрет отвергнут Cloudflare (ошибка настройки) — «недоступно», а не «токен плохой»; закрыто', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    for (const c of ['invalid-input-secret', 'missing-input-secret']) {
      await expect(
        new TurnstileService(answer({ success: false, 'error-codes': [c] })).verify('t', CTX, ENV),
      ).resolves.toEqual({ ok: false, reason: 'unavailable' });
    }
    // в журнал — причина без секрета
    expect(error.mock.calls.flat().join(' ')).not.toContain('secret-not-real');
    error.mockRestore();
  });

  it('сеть, не-200, не JSON, таймаут — «недоступно»: без проверки брони нет (fail-closed)', async () => {
    const down = [
      vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
      answer({ success: true }, 500),
      answer({ success: true }, 403),
      vi.fn(async () => new Response('<html>oops</html>', { status: 200 })),
      vi.fn(async () => {
        throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      }),
      answer('строка вместо объекта'),
      answer(null),
    ];
    for (const fetchImpl of down) {
      await expect(new TurnstileService(fetchImpl).verify('t', CTX, ENV)).resolves.toEqual({
        ok: false,
        reason: 'unavailable',
      });
    }
  });

  it('ответ «success» не строго true — не успех', async () => {
    for (const success of ['true', 1, undefined, null]) {
      const r = await new TurnstileService(answer({ success, hostname: 'hotel.example' })).verify(
        't',
        CTX,
        ENV,
      );
      expect(r.ok, String(success)).toBe(false);
    }
  });

  it('токен решён не на странице сайта — неверный: хост из ответа Cloudflare сверяется с доменами сайта', async () => {
    const t = (hostname: string) =>
      new TurnstileService(answer({ ...OK_BODY, hostname })).verify('t', CTX, ENV);
    await expect(t('evil.example')).resolves.toEqual({ ok: false, reason: 'invalid' });
    await expect(t('hotel.example')).resolves.toEqual({ ok: true });
    await expect(t('www.hotel.example')).resolves.toEqual({ ok: true });
    // демо-страница на адресе API
    await expect(t('api.example')).resolves.toEqual({ ok: true });
  });

  it('хоста в ответе нет — не повод отказывать (тестовые ключи Cloudflare)', async () => {
    await expect(
      new TurnstileService(answer({ success: true, action: 'booking' })).verify('t', CTX, ENV),
    ).resolves.toEqual({ ok: true });
  });

  it('токен, полученный для другого действия, не годится для брони', async () => {
    const t = (action: string) =>
      new TurnstileService(answer({ ...OK_BODY, action })).verify('t', CTX, ENV);
    await expect(t('login')).resolves.toEqual({ ok: false, reason: 'invalid' });
    await expect(t('booking')).resolves.toEqual({ ok: true });
  });
});

describe('Turnstile: отказ гостю', () => {
  it('нет токена — 400, неверный и устаревший — 403, недоступно — 503; текст без подробностей Cloudflare', () => {
    expect(turnstileFailureError('missing').getStatus()).toBe(400);
    expect(turnstileFailureError('invalid').getStatus()).toBe(403);
    expect(turnstileFailureError('expired').getStatus()).toBe(403);
    expect(turnstileFailureError('unavailable').getStatus()).toBe(503);
    expect(turnstileFailureError('missing').message).toMatch(/не робот/);
    expect(turnstileFailureError('expired').message).toMatch(/устарела/);
    expect(turnstileFailureError('unavailable').message).toMatch(/попробуйте позже/);
    for (const r of ['missing', 'invalid', 'expired', 'unavailable'] as const)
      expect(turnstileFailureError(r).message).not.toMatch(/cloudflare|siteverify|secret/i);
  });
});

describe('Turnstile: проверка настроек при старте', () => {
  it('не production — тихо', () => {
    expect(turnstileConfigNotice({})).toBeNull();
    expect(
      turnstileConfigNotice({ NODE_ENV: 'development', TURNSTILE_SECRET_KEY: 'x' }),
    ).toBeNull();
  });

  it('production, ничего не задано — предупреждение: бронь с сайта не защищена капчей', () => {
    const n = turnstileConfigNotice({ NODE_ENV: 'production' });
    expect(n?.level).toBe('warn');
    expect(n?.message).toMatch(/TURNSTILE_SECRET_KEY/);
  });

  it('production, заданы оба ключа — тихо', () => {
    expect(turnstileConfigNotice({ NODE_ENV: 'production', ...ENV })).toBeNull();
  });

  it('production, задан только один ключ — ошибка: такая настройка заблокировала бы все брони с сайта', () => {
    const onlySecret = turnstileConfigNotice({ NODE_ENV: 'production', TURNSTILE_SECRET_KEY: 's' });
    const onlySite = turnstileConfigNotice({ NODE_ENV: 'production', TURNSTILE_SITE_KEY: 'k' });
    expect(onlySecret?.level).toBe('error');
    expect(onlySite?.level).toBe('error');
    expect(onlySecret?.message).toMatch(/TURNSTILE_SITE_KEY/);
    expect(onlySite?.message).toMatch(/TURNSTILE_SECRET_KEY/);
  });
});
