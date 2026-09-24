import { describe, expect, it, vi } from 'vitest';
import { SellerClient, SellerRejectedError, SellerUnavailableError } from './seller-client';

/**
 * Клиент ИИ-продавца (ТЗ ред. 1 П7, Б5; docs/assistant/README.md §4): все вызовы — из API платформы по внутреннему
 * адресу с `X-Service-Key`. Браузер ни адреса, ни ключа не видит; в тексте ошибки ключа нет никогда.
 */

const KEY = 'seller-service-key-for-run-0123456789';
const BASE = 'http://seller:8000/panel-x/';

type Call = { url: string; init: RequestInit };

function client(respond: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(url), init: init ?? {} };
    calls.push(call);
    return respond(call);
  });
  return { calls, seller: new SellerClient({ baseUrl: BASE, serviceKey: KEY, fetch }) };
}

const header = (call: Call, name: string) => new Headers(call.init.headers).get(name);

describe('SellerClient — адреса и ключ', () => {
  it('список диалогов: адрес панели, служебный ключ заголовком, не в адресе', async () => {
    const { calls, seller } = client(() => Response.json({ items: [] }));
    await seller.listConversations({ mode: 'needs_human', limit: 30 });
    expect(calls[0]!.url).toBe('http://seller:8000/panel-x/conversations?mode=needs_human&limit=30');
    expect(calls[0]!.init.method).toBe('GET');
    expect(header(calls[0]!, 'x-service-key')).toBe(KEY);
    expect(calls[0]!.url).not.toContain(KEY);
  });

  it('карточка, перехват, возврат, ответ — по id диалога, id экранируется', async () => {
    const { calls, seller } = client(() => Response.json({ status: 'ok' }));
    await seller.conversation('a b');
    await seller.takeover('c1');
    await seller.release('c1');
    await seller.reply('c1', 'Здравствуйте');
    expect(calls.map((c) => `${c.init.method} ${c.url}`)).toEqual([
      'GET http://seller:8000/panel-x/conversations/a%20b',
      'POST http://seller:8000/panel-x/conversations/c1/takeover',
      'POST http://seller:8000/panel-x/conversations/c1/release',
      'POST http://seller:8000/panel-x/conversations/c1/reply',
    ]);
    expect(JSON.parse(String(calls[3]!.init.body))).toEqual({ text: 'Здравствуйте' });
    expect(header(calls[3]!, 'content-type')).toBe('application/json');
  });

  it('знания: список и загрузка файлом в поле file', async () => {
    const { calls, seller } = client(() => Response.json({ status: 'ok', chunks: 3 }));
    await seller.knowledge();
    await seller.uploadKnowledge({
      name: 'прайс.md',
      type: 'text/markdown',
      data: new TextEncoder().encode('# Цены'),
    });
    expect(calls[0]!.url).toBe('http://seller:8000/panel-x/knowledge');
    expect(calls[1]!.init.method).toBe('POST');
    const form = calls[1]!.init.body as FormData;
    const file = form.get('file') as File;
    expect(file.name).toBe('прайс.md');
    expect(await file.text()).toBe('# Цены');
    expect(header(calls[1]!, 'x-service-key')).toBe(KEY);
  });

  it('сводка, песочница, профиль, факты', async () => {
    const { calls, seller } = client(() => Response.json({ status: 'ok' }));
    await seller.summary();
    await seller.sandbox({ externalId: 'wetop-check-1', text: 'Есть места?' });
    await seller.putProfile({ address_form: 'informal' });
    await seller.putFacts({ source: 'platform:facts' });
    expect(calls.map((c) => `${c.init.method} ${c.url}`)).toEqual([
      'GET http://seller:8000/panel-x/summary',
      'POST http://seller:8000/panel-x/sandbox',
      'PUT http://seller:8000/panel-x/seller/profile',
      'PUT http://seller:8000/panel-x/seller/facts',
    ]);
    expect(JSON.parse(String(calls[1]!.init.body))).toEqual({
      external_id: 'wetop-check-1',
      text: 'Есть места?',
    });
  });
});

describe('SellerClient — отказы', () => {
  it('нет связи — «недоступен», ключа в тексте нет', async () => {
    const { seller } = client(() => {
      throw new TypeError(`fetch failed ${KEY}`);
    });
    const error = await seller.summary().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SellerUnavailableError);
    expect(String((error as Error).message)).not.toContain(KEY);
  });

  it('5xx — «недоступен» с кодом', async () => {
    const { seller } = client(() => new Response('{"status":"error"}', { status: 502 }));
    await expect(seller.summary()).rejects.toMatchObject({
      name: 'SellerUnavailableError',
      message: 'ИИ-продавец недоступен (HTTP 502)',
    });
  });

  it('тайм-аут — «не ответил вовремя»', async () => {
    const { seller } = client(() => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    });
    await expect(seller.summary()).rejects.toMatchObject({
      name: 'SellerUnavailableError',
      message: 'ИИ-продавец не ответил вовремя',
    });
  });

  it('4xx — «отклонил» с причиной продавца', async () => {
    const { seller } = client(
      () =>
        new Response('{"detail":"в поле найдены инструкции для модели"}', {
          status: 422,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const error = await seller.putProfile({}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SellerRejectedError);
    expect(error).toMatchObject({ status: 422, detail: 'в поле найдены инструкции для модели' });
  });

  it('проверка полей FastAPI списком — причины через «; »', async () => {
    const { seller } = client(() =>
      Response.json(
        { detail: [{ msg: 'field required' }, { msg: 'value too long' }] },
        { status: 422 },
      ),
    );
    await expect(seller.putFacts({})).rejects.toMatchObject({
      detail: 'field required; value too long',
    });
  });

  it('401/403 от продавца — ключ платформы не принят', async () => {
    const { seller } = client(() => Response.json({ status: 'forbidden' }, { status: 403 }));
    await expect(seller.summary()).rejects.toMatchObject({
      status: 403,
      detail: 'ИИ-продавец не принял служебный ключ платформы',
    });
  });

  it('песочница ждёт дольше остальных: ход с каскадом моделей длится до минуты', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const { seller } = client(() => Response.json({ status: 'ok', reply: 'Да' }));
    await seller.summary();
    await seller.sandbox({ externalId: 'x', text: 'y' });
    expect(timeout.mock.calls.map((c) => c[0])).toEqual([15_000, 90_000]);
    timeout.mockRestore();
  });

  it('без адреса или ключа клиент не создаётся', () => {
    expect(() => new SellerClient({ baseUrl: '', serviceKey: KEY })).toThrow(/адрес/);
    expect(() => new SellerClient({ baseUrl: BASE, serviceKey: ' ' })).toThrow(/ключ/);
    expect(() => new SellerClient({ baseUrl: 'seller:8000', serviceKey: KEY })).toThrow(/адрес/);
  });
});
