import { describe, expect, it } from 'vitest';
import { MailApiError, ResendMailer, mailConfigFromEnv } from './resend';

/** Отправка писем учётных записей. Форма запроса и ответа — docs/mail/README.md. */
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
const KEY = ['re', 'fake-key-for-tests'].join('_');
const letter = {
  to: 'aigul@example.invalid',
  subject: 'WETOP: задайте пароль',
  text: 'Ссылка: https://app.wetop.ai/login/set-password?token=abc',
};

describe('ResendMailer', () => {
  it('POST JSON на /emails, ключ в заголовке, письмо только текстом', async () => {
    const f = fakeFetch(() => ({ status: 200, body: { id: 'mail-1' } }));
    const mailer = new ResendMailer({ apiKey: KEY, from: 'WETOP <no-reply@wetop.ai>', fetch: f.fn });

    await expect(mailer.send(letter)).resolves.toEqual({ id: 'mail-1' });

    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]!.url).toBe('https://api.resend.com/emails');
    expect(f.calls[0]!.init.method).toBe('POST');
    const headers = f.calls[0]!.init.headers as Record<string, string>;
    expect(headers['authorization']).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(String(f.calls[0]!.init.body))).toEqual({
      from: 'WETOP <no-reply@wetop.ai>',
      to: [letter.to],
      subject: letter.subject,
      text: letter.text,
    });
  });

  it('201 тоже успех', async () => {
    const f = fakeFetch(() => ({ status: 201, body: { id: 'mail-2' } }));
    await expect(
      new ResendMailer({ apiKey: KEY, from: 'x@wetop.ai', fetch: f.fn }).send(letter),
    ).resolves.toEqual({ id: 'mail-2' });
  });

  it('ошибка сервиса не выносит наружу ни ключ, ни адрес получателя', async () => {
    const f = fakeFetch(() => ({
      status: 422,
      body: { name: 'validation_error', message: 'The from address is not verified' },
    }));
    const mailer = new ResendMailer({ apiKey: KEY, from: 'x@wetop.ai', fetch: f.fn });

    await expect(mailer.send(letter)).rejects.toThrow(MailApiError);
    const error = (await mailer.send(letter).catch((e: unknown) => e)) as MailApiError;
    expect(error.status).toBe(422);
    expect(error.message).toContain('The from address is not verified');
    expect(error.message).not.toContain(KEY);
    expect(error.message).not.toContain(letter.to);
  });

  it('нечитаемое тело ошибки не роняет отправку без объяснения', async () => {
    const fn: typeof fetch = async () => new Response('<html>502</html>', { status: 502 });
    const mailer = new ResendMailer({ apiKey: KEY, from: 'x@wetop.ai', fetch: fn });
    await expect(mailer.send(letter)).rejects.toThrow(/502/);
  });

  it('сеть молчит — это ошибка отправки, а не исключение мимо обработки', async () => {
    const fn: typeof fetch = async () => {
      throw new TypeError('fetch failed');
    };
    const mailer = new ResendMailer({ apiKey: KEY, from: 'x@wetop.ai', fetch: fn });
    await expect(mailer.send(letter)).rejects.toThrow(MailApiError);
  });
});

describe('mailConfigFromEnv', () => {
  it('без ключа отправки нет — и это не ошибка запуска', () => {
    expect(mailConfigFromEnv({})).toBeNull();
    expect(mailConfigFromEnv({ RESEND_API_KEY: '   ' })).toBeNull();
  });

  it('с ключом берёт отправителя из окружения, иначе умолчание', () => {
    expect(mailConfigFromEnv({ RESEND_API_KEY: KEY })).toEqual({
      apiKey: KEY,
      from: 'WETOP <no-reply@wetop.ai>',
    });
    expect(mailConfigFromEnv({ RESEND_API_KEY: KEY, MAIL_FROM: 'Стойка <desk@wetop.ai>' })).toEqual({
      apiKey: KEY,
      from: 'Стойка <desk@wetop.ai>',
    });
  });
});
