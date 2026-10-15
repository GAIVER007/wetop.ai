/**
 * CORE-SECURITY-FIX-01 / O2=A: ИИ-продавец остаётся ОРГАНИЗАЦИОННЫМ, ограниченному сотруднику (с назначениями) его
 * маршруты закрыты целиком, а владельцу и менеджеру без назначений открыты как раньше. Форма: тест утверждает
 * БЕЗОПАСНОЕ поведение (красный на коде до исправления).
 *
 * Бот-продавец подменён записывающей подделкой из самого продукта: ограниченный человек не должен дойти до вызова бота.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeConnection, FakeSeller } from '../../../apps/api/src/ai-seller/fakes';
import { SELLER_CONNECTION } from '../../../apps/api/src/ai-seller/seller.connection';
import {
  buildScopeWorld,
  OWN_SCOPE,
  RESTRICTED,
  UNRESTRICTED,
  type ScopeKey,
  type ScopeWorld,
  type UserKey,
} from './scope-world';

const ENABLED = !!process.env.DATABASE_URL;
const CONV = '11111111-1111-4111-8111-111111111111';
const AGENT = '22222222-2222-4222-8222-222222222222';
type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
type Route = [Method, string, object?];

/** Все 29 маршрутов `AiSellerController` (ai-seller.controller.ts) */
const CORE_ROUTES: Route[] = [
  ['get', '/ai-seller/status'],
  ['get', '/ai-seller/catalog'],
  ['get', '/ai-seller/profile'],
  ['put', '/ai-seller/profile', { greeting: 'S2 greeting' }],
  ['get', '/ai-seller/prompt'],
  ['get', '/ai-seller/prompt/versions'],
  ['post', `/ai-seller/prompt/versions/${CONV}/restore`],
  ['put', '/ai-seller/prompt', { text: 'S2 prompt' }],
  ['post', '/ai-seller/apply'],
  ['post', '/ai-seller/extract', { story: 'S2 story' }],
  ['get', '/ai-seller/llm-key'],
  ['put', '/ai-seller/llm-key', { key: 'synthetic-not-a-real-key' }],
  ['post', '/ai-seller/llm-key/check', { key: 'synthetic-not-a-real-key' }],
  ['get', '/ai-seller/whatsapp'],
  [
    'put',
    '/ai-seller/whatsapp',
    { phoneNumberId: '000', token: 'synthetic', appSecret: 'synthetic' },
  ],
  ['post', '/ai-seller/whatsapp/check', { phoneNumberId: '000', token: 'synthetic' }],
  ['get', '/ai-seller/facts'],
  ['get', '/ai-seller/conversations'],
  ['get', `/ai-seller/conversations/${CONV}`],
  ['post', `/ai-seller/conversations/${CONV}/takeover`],
  ['post', `/ai-seller/conversations/${CONV}/release`],
  ['patch', `/ai-seller/conversations/${CONV}/handling`, { handling: 'ai' }],
  ['post', `/ai-seller/conversations/${CONV}/notes`, { text: 'S2 note' }],
  ['post', `/ai-seller/conversations/${CONV}/reply`, { text: 'S2 reply' }],
  ['get', '/ai-seller/knowledge'],
  ['post', '/ai-seller/knowledge'],
  ['get', '/ai-seller/summary'],
  ['post', '/ai-seller/sandbox', { text: 'S2 hello' }],
  ['get', '/ai-seller/embed'],
];

/** Агенты по бизнесам и филиалам (SA2), инструкции, Telegram, черновики мастера гостя (за флагом WIZARD_ENABLED) */
const AGENT_ROUTES: Route[] = [
  ['get', '/ai-seller/agents/options'],
  ['post', '/ai-seller/agents', { name: 'S2 agent', businessId: CONV, locationId: CONV }],
  ['get', `/ai-seller/agents/${AGENT}`],
  ['get', `/ai-seller/agents/${AGENT}/instruction`],
  ['put', `/ai-seller/agents/${AGENT}/instruction`, { text: 'S2' }],
  ['post', `/ai-seller/agents/${AGENT}/instruction/generate`, { story: 'S2' }],
  ['get', `/ai-seller/agents/${AGENT}/telegram`],
  ['post', `/ai-seller/agents/${AGENT}/telegram/check`, {}],
  ['put', `/ai-seller/agents/${AGENT}/telegram`, {}],
  ['post', `/ai-seller/agents/${AGENT}/telegram/disconnect`],
  ['get', '/seller-agents'],
  ['post', '/seller-agents', {}],
  ['get', `/seller-agents/${AGENT}`],
  ['patch', `/seller-agents/${AGENT}`, {}],
  ['post', '/seller-agents/claim'],
];

describe.skipIf(!ENABLED)(
  'O2=A: ИИ-продавец закрыт ограниченным сотрудникам (HTTP + настоящая база + RLS)',
  () => {
    let w: ScopeWorld;
    const seller = new FakeSeller();
    const connection = new FakeConnection(
      {
        baseUrl: 'http://seller.invalid',
        serviceKey: 'synthetic',
        publicUrl: null,
        syncEnabled: false,
      },
      seller,
    );
    seller.replies['listConversations'] = { items: [], count: 0 };

    beforeAll(async () => {
      process.env.WIZARD_ENABLED = '1';
      w = await buildScopeWorld((b) => b.overrideProvider(SELLER_CONNECTION).useValue(connection));
    }, 180_000);
    afterAll(async () => {
      await w?.close();
      delete process.env.WIZARD_ENABLED;
    }, 60_000);

    const routes = [...CORE_ROUTES, ...AGENT_ROUTES];

    it('в списке все 29 маршрутов основного контроллера', () => {
      expect(CORE_ROUTES).toHaveLength(29);
    });

    it.each(RESTRICTED as readonly UserKey[])(
      '%s (ограничен): каждый маршрут продавца и агентов даёт 403 со своим указателем и без него, бот не вызывается',
      async (user) => {
        seller.calls.length = 0;
        const failed: string[] = [];
        for (const scope of [OWN_SCOPE[user]!, 'NONE'] as ScopeKey[])
          for (const [method, path, body] of routes) {
            const r = await w.call(user, method, path, { scope, ...(body ? { body } : {}) });
            if (r.status !== 403)
              failed.push(
                `${scope} ${method.toUpperCase()} ${path} -> ${r.status} ${r.text.slice(0, 80)}`,
              );
          }
        expect(failed, 'маршруты, открытые ограниченному').toEqual([]);
        expect(
          seller.calls.map((c) => c.op),
          'вызовы бота',
        ).toEqual([]);
      },
      180_000,
    );

    it('T08/S1 менеджер САЛОНА не видит каталог продавца гостиницы (и ни одного вызова бота)', async () => {
      seller.calls.length = 0;
      const r = await w.call('BEA_MGR', 'get', '/ai-seller/catalog', { scope: 'BEA+LB' });
      expect(r.status).toBe(403);
      expect(r.text).not.toContain(w.ids.h1!);
      expect(seller.calls).toEqual([]);
    });

    it('T09 менеджер САЛОНА не меняет приветствие рабочего продавца: 403 и ни одного вызова бота', async () => {
      seller.calls.length = 0;
      const r = await w.call('BEA_MGR', 'put', '/ai-seller/profile', {
        scope: 'BEA+LB',
        body: { greeting: 'S2 greeting from BEAUTY manager' },
      });
      expect({ status: r.status, bot: seller.calls.map((c) => c.op) }).toEqual({
        status: 403,
        bot: [],
      });
    });

    it('T10/S3 менеджер филиала H2 не меняет настройки продавца и не переключает чужой диалог', async () => {
      seller.calls.length = 0;
      const put = await w.call('H2_MGR', 'put', '/ai-seller/profile', {
        scope: 'HOT+H2',
        body: { greeting: 'S2 from H2' },
      });
      const take = await w.call('H2_MGR', 'post', `/ai-seller/conversations/${CONV}/takeover`, {
        scope: 'HOT+H2',
      });
      expect({ put: put.status, take: take.status, bot: seller.calls.map((c) => c.op) }).toEqual({
        put: 403,
        take: 403,
        bot: [],
      });
    });

    it('S2/S5 STAFF салона не отвечает гостю от имени продавца, менеджер салона не подменяет ключ модели и WhatsApp', async () => {
      seller.calls.length = 0;
      const reply = await w.call(
        'BEA_LOC_STAFF',
        'post',
        `/ai-seller/conversations/${CONV}/reply`,
        {
          scope: 'BEA+LB',
          body: { text: 'S2 text from beauty staff' },
        },
      );
      const key = await w.call('BEA_MGR', 'put', '/ai-seller/llm-key', {
        scope: 'BEA+LB',
        body: { key: 'synthetic' },
      });
      const wa = await w.call('BEA_MGR', 'put', '/ai-seller/whatsapp', {
        scope: 'BEA+LB',
        body: { phoneNumberId: '000', token: 'synthetic', appSecret: 'synthetic' },
      });
      expect({
        reply: reply.status,
        key: key.status,
        wa: wa.status,
        bot: seller.calls.map((c) => c.op),
      }).toEqual({
        reply: 403,
        key: 403,
        wa: 403,
        bot: [],
      });
    });

    it('403 несёт понятный русский текст (то же сообщение, что у других организационных разделов)', async () => {
      const r = await w.call('H1_MGR', 'get', '/ai-seller/status', { scope: 'HOT+H1' });
      expect(r.status).toBe(403);
      expect(r.text).toContain('без ограничения по филиалам');
    });

    // ── контроль: поведение для неограниченных не изменилось ───────────────────────────────────────────

    it.each(UNRESTRICTED as readonly UserKey[])(
      'контроль: %s (без назначений) по-прежнему открывает каталог, статус и агентов (владелец и менеджер: настройки)',
      async (user) => {
        const catalog = await w.call(user, 'get', '/ai-seller/catalog', { scope: 'HOT+H1' });
        const status = await w.call(user, 'get', '/ai-seller/status', { scope: 'HOT+H1' });
        const options = await w.call(user, 'get', '/ai-seller/agents/options', { scope: 'HOT+H1' });
        expect({ catalog: catalog.status, status: status.status, options: options.status }).toEqual(
          {
            catalog: 200,
            status: 200,
            options: 200,
          },
        );
      },
    );

    it('контроль: владелец достигает бота (подделка подключена правильно) и меняет профиль', async () => {
      seller.calls.length = 0;
      const list = await w.call('OWNER', 'get', '/ai-seller/conversations', { scope: 'HOT+H1' });
      expect(list.status).toBe(200);
      expect(seller.calls.map((c) => c.op)).toContain('listConversations');
      const put = await w.call('OWNER', 'put', '/ai-seller/profile', {
        scope: 'HOT+H1',
        body: { greeting: 'S2 owner greeting' },
      });
      expect(put.status, put.text.slice(0, 120)).toBeLessThan(300);
    });

    it('контроль: менеджер без назначений видит черновики мастера (/seller-agents за флагом) и настройки', async () => {
      const list = await w.call('ORG_MGR', 'get', '/seller-agents', { scope: 'HOT+H1' });
      expect(list.status, list.text.slice(0, 120)).toBe(200);
      const profile = await w.call('ORG_MGR', 'get', '/ai-seller/profile', { scope: 'HOT+H1' });
      expect(profile.status).toBe(200);
    });

    it('контроль: администратор без назначений читает диалоги, но не настройки (права ролей не менялись)', async () => {
      const dialogs = await w.call('ORG_STAFF', 'get', '/ai-seller/conversations', {
        scope: 'HOT+H1',
      });
      expect(dialogs.status).toBe(200);
      const profile = await w.call('ORG_STAFF', 'get', '/ai-seller/profile', { scope: 'HOT+H1' });
      expect(profile.status).toBe(403);
    });

    it('чужая организация: расширения у неё нет, данных организации A в ответе нет', async () => {
      for (const path of ['/ai-seller/catalog', '/ai-seller/status', '/ai-seller/agents/options']) {
        const r = await w.call('FOREIGN', 'get', path);
        expect(
          r.tokens.filter((t) => t !== 'S2ORGB'),
          path,
        ).toEqual([]);
        expect(r.text, path).not.toContain(w.ids.h1!);
      }
    });
  },
);
