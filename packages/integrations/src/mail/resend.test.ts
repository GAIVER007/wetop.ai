import { beforeEach, describe, expect, it } from 'vitest';

import { ResendMailSender } from './resend';
import { MailError, type MailConfig } from './sender';

const config: MailConfig = {
  provider: 'resend',
  apiKey: 're_secret_value_do_not_leak',
  from: 'noreply@send.wetop.ai',
  fromName: 'WETOP',
};

const letter = { to: 'gost@example.com', subject: 'Код для входа в WETOP', text: 'Код: 123456' };

function okResponse() {
  return new Response(JSON.stringify({ id: 'abc' }), { status: 200 });
}
function errorResponse(status: number, name: string, message = 'подробности') {
  return new Response(JSON.stringify({ name, message }), { status });
}

describe('отправка через Resend', () => {
  let calls: Array<{ url: string; init: RequestInit }>;
  let sleeps: number[];

  beforeEach(() => {
    calls = [];
    sleeps = [];
  });

  function sender(responses: Response[], idempotencyKey?: () => string) {
    const queue = [...responses];
    return new ResendMailSender({
      config,
      // Необязательное поле передаём, только если оно есть: в проекте включена строгая
      // проверка (`exactOptionalPropertyTypes`), и явный undefined здесь недопустим.
      ...(idempotencyKey ? { idempotencyKey } : {}),
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      fetch: (async (url: string, init: RequestInit) => {
        calls.push({ url: String(url), init });
        const next = queue.shift();
        if (!next) throw new Error('лишний запрос');
        return next;
      }) as unknown as typeof fetch,
    });
  }

  it('письмо уходит по адресу из документации, с ключом в заголовке и текстом в теле', async () => {
    await sender([okResponse()]).send(letter);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://api.resend.com/emails');
    expect(calls[0]!.init.method).toBe('POST');
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer re_secret_value_do_not_leak');
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body).toEqual({
      from: 'WETOP <noreply@send.wetop.ai>',
      to: 'gost@example.com',
      subject: 'Код для входа в WETOP',
      text: 'Код: 123456',
    });
  });

  it('поле html не отправляем вовсе', async () => {
    await sender([okResponse()]).send(letter);
    expect(JSON.parse(String(calls[0]!.init.body))).not.toHaveProperty('html');
  });

  it('без подписи отправителя уходит голый адрес', async () => {
    const s = new ResendMailSender({
      config: { ...config, fromName: '' },
      fetch: (async (url: string, init: RequestInit) => {
        calls.push({ url: String(url), init });
        return okResponse();
      }) as unknown as typeof fetch,
    });
    await s.send(letter);
    expect(JSON.parse(String(calls[0]!.init.body)).from).toBe('noreply@send.wetop.ai');
  });

  it('ключ идемпотентности уходит заголовком, когда он задан', async () => {
    await sender([okResponse()], () => 'код-для-gost-в-12-00').send(letter);
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers['idempotency-key']).toBe('код-для-gost-в-12-00');
  });

  it('без ключа идемпотентности заголовка нет — пустого не шлём', async () => {
    await sender([okResponse()]).send(letter);
    expect(calls[0]!.init.headers as Record<string, string>).not.toHaveProperty('idempotency-key');
  });
});

describe('Resend: отказы', () => {
  let sleeps: number[];
  let attempts: number;

  beforeEach(() => {
    sleeps = [];
    attempts = 0;
  });

  function sender(responses: Response[]) {
    const queue = [...responses];
    return new ResendMailSender({
      config,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      fetch: (async () => {
        attempts += 1;
        const next = queue.shift();
        if (!next) throw new Error('лишний запрос');
        return next;
      }) as unknown as typeof fetch,
    });
  }

  it('429 повторяется один раз и проходит', async () => {
    await sender([errorResponse(429, 'rate_limit_exceeded'), okResponse()]).send(letter);
    expect(attempts).toBe(2);
    expect(sleeps).toEqual([1000]);
  });

  it('503 тоже повторяется', async () => {
    await sender([errorResponse(503, 'service_unavailable'), okResponse()]).send(letter);
    expect(attempts).toBe(2);
  });

  it('повтор ровно один: второй отказ уже отдаём наверх', async () => {
    const s = sender([errorResponse(500, 'application_error'), errorResponse(500, 'application_error')]);
    await expect(s.send(letter)).rejects.toThrow(MailError);
    expect(attempts).toBe(2);
  });

  it('422 не повторяется — это наша ошибка в запросе, а не заминка на той стороне', async () => {
    const s = sender([errorResponse(422, 'missing_required_field')]);
    await expect(s.send(letter)).rejects.toMatchObject({ retriable: false });
    expect(attempts).toBe(1);
  });

  it('401 не повторяется и помечен как неповторяемый', async () => {
    const s = sender([errorResponse(401, 'missing_api_key')]);
    await expect(s.send(letter)).rejects.toMatchObject({ retriable: false });
    expect(attempts).toBe(1);
  });

  it('в тексте ошибки есть имя отказа и код, чтобы было что чинить', async () => {
    const s = sender([errorResponse(403, 'suspended_api_key', 'This API key is suspended')]);
    await expect(s.send(letter)).rejects.toThrow(/403.*suspended_api_key/);
  });

  it('ключ не протекает в текст ошибки, даже если Resend вернул его в своём сообщении', async () => {
    const s = sender([
      errorResponse(401, 'restricted_api_key', 'ключ re_secret_value_do_not_leak не подошёл'),
    ]);
    const err = await s.send(letter).catch((e: Error) => e);
    expect((err as Error).message).toContain('<ключ>');
    expect((err as Error).message).not.toContain('re_secret_value_do_not_leak');
  });

  it('адрес почты не протекает в текст ошибки, даже если Resend назвал его в своём сообщении', async () => {
    // Почта — персональные данные (SECURITY.md §11): текст ошибки уходит в журнал API и на экран
    const s = sender([
      errorResponse(
        403,
        'validation_error',
        'You can only send testing emails to your own email address (owner.test@example.org), not gost@example.com',
      ),
    ]);
    const err = (await s.send(letter).catch((e: Error) => e)) as MailError;
    expect(err.message).toContain('403');
    expect(err.message).toContain('<почта>');
    expect(err.message).not.toContain('gost@example.com');
    expect(err.message).not.toContain('owner.test@example.org');
  });

  it('сеть не ответила — ошибка помечена повторяемой, ключ в ней не светится', async () => {
    const s = new ResendMailSender({
      config,
      sleep: async () => {},
      fetch: (async () => {
        throw new Error('соединение оборвано, ключ re_secret_value_do_not_leak');
      }) as unknown as typeof fetch,
    });
    const err = (await s.send(letter).catch((e: Error) => e)) as MailError;
    expect(err.retriable).toBe(true);
    expect(err.message).toContain('<ключ>');
    expect(err.message).not.toContain('re_secret_value_do_not_leak');
  });

  it('ответ без разбираемого тела не роняет клиент', async () => {
    const s = sender([new Response('не json', { status: 400 })]);
    await expect(s.send(letter)).rejects.toThrow(/400/);
  });
});
