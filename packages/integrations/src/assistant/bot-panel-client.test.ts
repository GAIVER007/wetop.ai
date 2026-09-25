import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  BotPanelClient,
  BotRejectedError,
  BotUnavailableError,
  SUPPORT_BOT,
  SellerClient,
  SellerRejectedError,
  SellerUnavailableError,
  widgetOrgKey,
} from './bot-panel-client';

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
    expect(calls[0]!.url).toBe(
      'http://seller:8000/panel-x/conversations?mode=needs_human&limit=30',
    );
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
    // Песочница у бота — в корне экземпляра, не под путём панели (`src/dashboard_router.py`, `/internal/sandbox`):
    // путь зафиксирован сборочным планом бота, служебный ключ платформы она принимает тем же заголовком
    expect(calls.map((c) => `${c.init.method} ${c.url}`)).toEqual([
      'GET http://seller:8000/panel-x/summary',
      'POST http://seller:8000/internal/sandbox',
      'PUT http://seller:8000/panel-x/seller/profile',
      'PUT http://seller:8000/panel-x/seller/facts',
    ]);
    expect(header(calls[1]!, 'x-service-key')).toBe(KEY);
    expect(JSON.parse(String(calls[1]!.init.body))).toEqual({
      external_id: 'wetop-check-1',
      text: 'Есть места?',
    });
  });

  it('рассказ владельца уходит на /extract-profile под путём панели телом { story }', async () => {
    const { calls, seller } = client(() => Response.json({ status: 'ok', profile: {} }));
    await seller.extractProfile('У нас хостел в Алматы, койка 8000 тенге.');
    expect(calls.map((c) => `${c.init.method} ${c.url}`)).toEqual([
      'POST http://seller:8000/panel-x/extract-profile',
    ]);
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      story: 'У нас хостел в Алматы, койка 8000 тенге.',
    });
    expect(header(calls[0]!, 'x-service-key')).toBe(KEY);
  });

  it('панель под длинным путём — песочница всё равно в корне того же адреса', async () => {
    const calls: Call[] = [];
    const seller = new SellerClient({
      baseUrl: 'https://seller.internal:8443/a/b/panel/',
      serviceKey: KEY,
      fetch: vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), init: init ?? {} });
        return Response.json({ status: 'ok' });
      }),
    });
    await seller.sandbox({ externalId: 'x', text: 'y' });
    expect(calls[0]!.url).toBe('https://seller.internal:8443/internal/sandbox');
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
      name: 'BotUnavailableError',
      message: 'ИИ-продавец недоступен (HTTP 502)',
    });
  });

  it('тайм-аут — «не ответил вовремя»', async () => {
    const { seller } = client(() => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    });
    await expect(seller.summary()).rejects.toMatchObject({
      name: 'BotUnavailableError',
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

  it('401 и 403 без причины — ключ платформы не принят', async () => {
    const { seller } = client(() => Response.json({ status: 'forbidden' }, { status: 403 }));
    await expect(seller.summary()).rejects.toMatchObject({
      status: 403,
      detail: 'ИИ-продавец не принял служебный ключ платформы',
    });
    // 401 у панели бота — «Сессия истекла, войдите заново»: для служебного ключа это неверный ключ
    const second = client(() =>
      Response.json({ detail: 'Сессия истекла, войдите заново' }, { status: 401 }),
    );
    await expect(second.seller.summary()).rejects.toMatchObject({
      status: 401,
      detail: 'ИИ-продавец не принял служебный ключ платформы',
    });
  });

  it('403 с причиной продавца — его слова: адрес платформы не в списке, маршрут закрыт', async () => {
    for (const reason of ['Доступ с этого адреса закрыт', 'Служебному ключу этот маршрут закрыт']) {
      const { seller } = client(() => Response.json({ detail: reason }, { status: 403 }));
      await expect(seller.summary()).rejects.toMatchObject({ status: 403, detail: reason });
    }
  });

  it('отказ профиля объектом `{ message, fields }` (Б6, слой 9) — причина и имена полей', async () => {
    const { seller } = client(() =>
      Response.json(
        {
          detail: {
            message: 'В полях найдены инструкции для модели',
            fields: ['greeting', 'house_rules'],
          },
        },
        { status: 422 },
      ),
    );
    const error = await seller.putProfile({}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SellerRejectedError);
    expect(error).toMatchObject({
      status: 422,
      detail: 'В полях найдены инструкции для модели',
      fields: ['greeting', 'house_rules'],
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

/**
 * Тот же клиент — к панели ИИ-помощника (`BOT_ROLE=support`, «Платформа → Техподдержка», план
 * `plans/platform-roles-extensions-2026-09-25.md` Э3): у обеих ролей бота маршруты панели и служебный ключ одни
 * (`src/dashboard/auth_router.py`, `SERVICE_ROUTES`). Отличаются только слова: отказ называет того бота, что отказал.
 */
describe('Э4 — организация в клиенте панели (ADR-083)', () => {
  const ORG = '5d2f1a9e-8c7b-4e3a-a1f0-6b9c2d4e8f00';

  it('X-Organization на каждом вызове панели и organization_id в песочнице', async () => {
    const calls: Call[] = [];
    const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return Response.json({ status: 'ok' });
    });
    const seller = new BotPanelClient({
      baseUrl: BASE,
      serviceKey: KEY,
      organizationId: ORG,
      fetch,
    });
    await seller.listConversations({});
    await seller.putProfile({ object_name: 'Гостиница А' });
    await seller.sandbox({ externalId: 'check-1', text: 'Привет' });
    for (const call of calls) expect(header(call, 'x-organization')).toBe(ORG);
    const sandboxBody = JSON.parse(String(calls[2]!.init.body)) as Record<string, unknown>;
    expect(sandboxBody.organization_id).toBe(ORG);
    // без организации (помощник) заголовка нет — поведение прежнее
    calls.length = 0;
    const support = new BotPanelClient({ baseUrl: BASE, serviceKey: KEY, fetch });
    await support.listConversations({});
    await support.sandbox({ externalId: 'check-1', text: 'Привет' });
    expect(header(calls[0]!, 'x-organization')).toBeNull();
    expect(
      JSON.parse(String(calls[1]!.init.body)) as Record<string, unknown>,
    ).not.toHaveProperty('organization_id');
  });

  it('заведение гостиницы: PUT /seller/organizations/{id} полями бота', async () => {
    const { calls, seller } = client(() => Response.json({ status: 'ok' }));
    await seller.putOrganization(ORG, {
      name: 'Гостиница А',
      publicKey: 'sk_' + 'a1'.repeat(12),
      active: false,
      hosts: ['hotel-a.example.test'],
    });
    expect(calls[0]!.init.method).toBe('PUT');
    expect(calls[0]!.url).toBe(`http://seller:8000/panel-x/seller/organizations/${ORG}`);
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      name: 'Гостиница А',
      public_key: 'sk_' + 'a1'.repeat(12),
      active: false,
      hosts: ['hotel-a.example.test'],
    });
  });

  it('widgetOrgKey: sk_ + 24 hex, свой у каждой организации, из ключа не восстановим', () => {
    const key = widgetOrgKey(KEY, ORG);
    expect(key).toMatch(/^sk_[0-9a-f]{24}$/);
    // контракт деривации (docs/assistant/README.md §4): HMAC-SHA256(ключ, 'seller-widget|<org>')
    const reference =
      'sk_' + createHmac('sha256', KEY).update(`seller-widget|${ORG}`).digest('hex').slice(0, 24);
    expect(key).toBe(reference);
    expect(widgetOrgKey(KEY, 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb')).not.toBe(key);
    expect(key).not.toContain(KEY);
  });
});

describe('BotPanelClient — панель помощника', () => {
  const support = (respond: () => Response | Promise<Response>) =>
    new BotPanelClient({
      baseUrl: 'http://assistant:8000/p0123456789ab',
      serviceKey: KEY,
      bot: SUPPORT_BOT,
      fetch: vi.fn(async () => respond()),
    });

  it('отказы называют помощника, а не продавца', async () => {
    await expect(
      support(() => new Response('{}', { status: 502 })).summary(),
    ).rejects.toMatchObject({
      message: 'ИИ-помощник недоступен (HTTP 502)',
    });
    await expect(
      support(() => {
        throw new DOMException('timeout', 'TimeoutError');
      }).summary(),
    ).rejects.toMatchObject({ message: 'ИИ-помощник не ответил вовремя' });
    await expect(
      support(() => {
        throw new TypeError('fetch failed');
      }).summary(),
    ).rejects.toMatchObject({ message: 'Нет связи с ИИ-помощником' });
    await expect(
      support(() =>
        Response.json({ detail: 'Сессия истекла, войдите заново' }, { status: 401 }),
      ).summary(),
    ).rejects.toMatchObject({ detail: 'ИИ-помощник не принял служебный ключ платформы' });
    const rejected = await support(() =>
      Response.json({ detail: 'диалог не найден' }, { status: 404 }),
    )
      .conversation('x')
      .catch((e: unknown) => e);
    expect(rejected).toBeInstanceOf(BotRejectedError);
    expect((rejected as Error).message).toBe(
      'ИИ-помощник отклонил запрос (HTTP 404): диалог не найден',
    );
  });

  it('правила и модель помощника — под путём панели, тем же ключом (ADR-084)', async () => {
    const calls: Call[] = [];
    const client = new BotPanelClient({
      baseUrl: 'http://assistant:8000/p0123456789ab',
      serviceKey: KEY,
      bot: SUPPORT_BOT,
      fetch: vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), init: init ?? {} });
        return Response.json({ status: 'ok' });
      }),
    });
    await client.prompt();
    await client.putPrompt('Ты — помощник WETOP.');
    await client.settings();
    await client.putModel('модель-б');
    expect(calls.map((c) => `${c.init.method} ${c.url}`)).toEqual([
      'GET http://assistant:8000/p0123456789ab/prompt',
      'PUT http://assistant:8000/p0123456789ab/prompt',
      'GET http://assistant:8000/p0123456789ab/settings',
      'PUT http://assistant:8000/p0123456789ab/settings/model',
    ]);
    expect(JSON.parse(String(calls[1]!.init.body))).toEqual({ text: 'Ты — помощник WETOP.' });
    expect(JSON.parse(String(calls[3]!.init.body))).toEqual({ model: 'модель-б' });
    expect(calls.every((c) => header(c, 'x-service-key') === KEY)).toBe(true);
  });

  it('прежние имена раздела продавца — те же классы: его проверки `instanceof` не меняются', async () => {
    expect(SellerClient).toBe(BotPanelClient);
    expect(SellerRejectedError).toBe(BotRejectedError);
    expect(SellerUnavailableError).toBe(BotUnavailableError);
    // без названия клиент говорит о продавце, как раньше
    const seller = new SellerClient({
      baseUrl: BASE,
      serviceKey: KEY,
      fetch: vi.fn(async () => new Response('{}', { status: 503 })),
    });
    await expect(seller.summary()).rejects.toMatchObject({
      message: 'ИИ-продавец недоступен (HTTP 503)',
    });
  });
});
