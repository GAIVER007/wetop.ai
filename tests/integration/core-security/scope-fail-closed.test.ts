/**
 * CORE-SECURITY-FIX-01 / F4a, O4=A (fail-closed): человеческий запрос, у которого указатель области ЯВНО отклонён
 * (чужая организация, архивный бизнес или филиал, филиал не из бизнеса, битый uuid, повтор ключа, филиал без бизнеса), получает
 * 403, а не молча превращается в ORGANIZATION с самым ранним объектом. Различаем «заголовка нет вообще» (организация, как всегда)
 * и «заголовок есть, но отклонён». Форма: тест утверждает БЕЗОПАСНОЕ поведение (красный на коде до исправления).
 *
 * Исключения (обоснование в отчёте): публичные и служебные маршруты, личные (`self`, среди них `GET /auth/me`, по которому
 * стойка восстанавливает указатель), раздел платформы и `@ScopeAware` (выбор филиала, сводка), которые сами восстанавливают указатель.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildScopeWorld, type ScopeWorld, type UserKey } from './scope-world';

const ENABLED = !!process.env.DATABASE_URL;

describe.skipIf(!ENABLED)(
  'F4a / O4=A: отклонённый указатель области даёт 403 (HTTP + настоящая база + RLS)',
  () => {
    let w: ScopeWorld;
    let archivedLocation = '';
    let archivedBusiness = '';
    let archivedBusinessLocation = '';

    beforeAll(async () => {
      w = await buildScopeWorld();
      const loc = await w.db.location.create({
        data: {
          businessId: w.ids.hot!,
          name: `S2 archived location ${w.ids.m}`,
          timezone: 'Asia/Almaty',
          currency: 'KZT',
          status: 'ARCHIVED',
        },
      });
      archivedLocation = loc.id;
      const biz = await w.db.business.create({
        data: {
          organizationId: w.ids.orgA!,
          name: `S2 archived business ${w.ids.m}`,
          vertical: 'HOSPITALITY',
          status: 'ARCHIVED',
        },
      });
      archivedBusiness = biz.id;
      archivedBusinessLocation = (
        await w.db.location.create({
          data: {
            businessId: biz.id,
            name: `S2 loc of archived ${w.ids.m}`,
            timezone: 'Asia/Almaty',
            currency: 'KZT',
          },
        })
      ).id;
    }, 180_000);
    afterAll(async () => {
      await w?.close();
    }, 60_000);

    /** Отклонённые указатели: каждый раз header есть, но API его не принимает */
    const rejected = (): Record<string, string> => ({
      'чужая организация': `business=${w.ids.hotB};location=${w.ids.hB}`,
      'битый указатель': 'garbage',
      'не uuid': 'business=not-a-uuid',
      'филиал не из этого бизнеса': `business=${w.ids.bea};location=${w.ids.h1}`,
      'повтор ключа': `business=${w.ids.hot};business=${w.ids.bea}`,
      'филиал без бизнеса': `location=${w.ids.h1}`,
      'архивный филиал': `business=${w.ids.hot};location=${archivedLocation}`,
      'архивный бизнес': `business=${archivedBusiness};location=${archivedBusinessLocation}`,
    });

    /** Маршруты человека: без capability (задачи, касса, настройки), с capability (шахматка), гости, бар */
    const HUMAN_GETS = [
      '/tasks',
      '/chessboard',
      '/hotel/settings',
      '/finance/cash',
      '/market/occupancy',
      '/bar/categories',
      '/guests/directory',
      '/ai-seller/status',
    ];

    it.each(['OWNER', 'ORG_MGR', 'ORG_STAFF'] as const)(
      'T13 %s (без назначений): каждый отклонённый указатель даёт 403 на маршрутах с capability и без неё',
      async (user) => {
        const failed: string[] = [];
        for (const [kind, header] of Object.entries(rejected()))
          for (const path of HUMAN_GETS) {
            const r = await w.call(user, 'get', path, { scope: header });
            if (r.status !== 403)
              failed.push(`${kind}: GET ${path} -> ${r.status} ${r.tokens.join(',')}`);
          }
        expect(failed, 'отклонённый указатель молча стал организацией').toEqual([]);
      },
      120_000,
    );

    it.each(['H1_MGR', 'H1_STAFF', 'BEA_MGR', 'FOO_MGR', 'HOT_MGR'] as const)(
      '%s (ограничен): отклонённый указатель тоже даёт 403',
      async (user) => {
        const failed: string[] = [];
        for (const [kind, header] of Object.entries(rejected()))
          for (const path of ['/tasks', '/chessboard']) {
            const r = await w.call(user, 'get', path, { scope: header });
            if (r.status !== 403) failed.push(`${kind}: GET ${path} -> ${r.status}`);
          }
        expect(failed).toEqual([]);
      },
      120_000,
    );

    it('FOREIGN: указатель организации A (чужой для него) даёт 403, а не данные его собственного объекта', async () => {
      const r = await w.call('FOREIGN', 'get', '/tasks', {
        scope: `business=${w.ids.hot};location=${w.ids.h1}`,
      });
      expect(r.status).toBe(403);
      expect(r.tokens).toEqual([]);
    });

    it.each(['OWNER', 'ORG_MGR', 'ORG_STAFF'] as const)(
      'T14 %s: устаревший указатель + POST /tasks не пишет в самый ранний объект (403, ноль записей)',
      async (user) => {
        const before = await w.db.deskTask.count({ where: { propertyId: w.ids.p1! } });
        for (const header of Object.values(rejected())) {
          const r = await w.call(user, 'post', '/tasks', {
            scope: header,
            body: { title: `S2 stale pointer task ${user}`, dueDate: '2030-03-01' },
          });
          expect(r.status, header).toBe(403);
        }
        expect(await w.db.deskTask.count({ where: { propertyId: w.ids.p1! } })).toBe(before);
        expect(
          await w.db.deskTask.count({ where: { title: { startsWith: 'S2 stale pointer task' } } }),
        ).toBe(0);
      },
    );

    // ── что остаётся как есть ────────────────────────────────────────────────────────────────────────

    it.each(['OWNER', 'ORG_MGR', 'ORG_STAFF'] as const)(
      'T14b %s: заголовка нет вообще: организация, как раньше (самый ранний объект), 200',
      async (user) => {
        const tasks = await w.call(user, 'get', '/tasks');
        const chess = await w.call(user, 'get', '/chessboard');
        expect({ tasks: tasks.status, chess: chess.status, tokens: tasks.tokens }).toEqual({
          tasks: 200,
          chess: 200,
          tokens: ['S2P1'],
        });
      },
    );

    it.each([
      ['пустой заголовок', ''],
      ['заголовок из пробелов', '   '],
    ])('%s считается отсутствием указателя, а не отклонённым', async (_name, header) => {
      const r = await w.call('ORG_MGR', 'get', '/tasks', { headers: { 'X-Wetop-Scope': header } });
      expect(r.status).toBe(200);
    });

    it('пробелы вокруг правильного указателя допустимы: он принят', async () => {
      const r = await w.call('ORG_MGR', 'get', '/tasks', {
        headers: { 'X-Wetop-Scope': ` business=${w.ids.hot};location=${w.ids.h1} ` },
      });
      expect(r.status).toBe(200);
      expect(r.tokens).toEqual(['S2P1']);
    });

    it('ограниченный без заголовка: 403 «выберите филиал» (как раньше)', async () => {
      const r = await w.call('H1_MGR', 'get', '/tasks');
      expect(r.status).toBe(403);
      expect(r.text).toContain('Выберите доступный вам филиал');
    });

    it.each(['OWNER', 'ORG_MGR', 'HOT_MGR'] as const)(
      'указатель только на бизнес (BUSINESS) принят: %s читает /tasks (самый ранний филиал бизнеса, F4b вне этого пункта)',
      async (user) => {
        const r = await w.call(user, 'get', '/tasks', { scope: 'HOT' });
        expect(r.status).toBe(200);
        expect(r.tokens).toEqual(['S2P1']);
      },
    );

    it.each(['OWNER', 'ORG_MGR', 'ORG_STAFF', 'H1_MGR', 'H1_STAFF'] as const)(
      'правильный указатель на филиал по-прежнему работает: %s',
      async (user) => {
        for (const path of ['/tasks', '/chessboard']) {
          const r = await w.call(user, 'get', path, { scope: 'HOT+H1' });
          expect({ path, status: r.status }).toEqual({ path, status: 200 });
        }
      },
    );

    it('правильный указатель на H2 открывает данные H2, а не самого раннего объекта', async () => {
      const r = await w.call('ORG_MGR', 'get', '/tasks', { scope: 'HOT+H2' });
      expect(r.status).toBe(200);
      expect(r.tokens).toEqual(['S2P2']);
      const write = await w.call('ORG_MGR', 'post', '/tasks', {
        scope: 'HOT+H2',
        body: { title: 'S2 task to H2', dueDate: '2030-03-02' },
      });
      expect(write.status).toBe(201);
      expect(
        await w.db.deskTask.count({ where: { propertyId: w.ids.p2!, title: 'S2 task to H2' } }),
      ).toBe(1);
    });

    // ── исключения: маршруты, которым отклонённый указатель не мешает ─────────────────────────────────

    it.each([
      'OWNER',
      'ORG_MGR',
      'ORG_STAFF',
      'H1_MGR',
      'H1_STAFF',
      'BEA_MGR',
      'FOO_MGR',
      'HOT2_MGR',
    ] as const satisfies readonly UserKey[])(
      'восстановление указателя в вебе не ломается (%s): /auth/me, выбор филиала и личные маршруты отвечают 200 при любом отклонённом указателе',
      async (user) => {
        const failed: string[] = [];
        for (const [kind, header] of Object.entries(rejected()))
          for (const path of [
            '/auth/me',
            '/branches',
            '/branches/overview?from=2030-01-01&to=2030-01-31',
            '/auth/sessions',
            '/auth/registration-context',
          ]) {
            const r = await w.call(user, 'get', path, { scope: header });
            if (r.status !== 200)
              failed.push(`${kind}: GET ${path} -> ${r.status} ${r.text.slice(0, 80)}`);
          }
        expect(failed).toEqual([]);
      },
      120_000,
    );

    it('цепочка восстановления (как в вебе): устаревшая кука, /auth/me не подтверждает выбор, /branches без выбора, правильный выбор работает', async () => {
      const stale = `business=${w.ids.hotB};location=${w.ids.hB}`;
      // 1. стойка спрашивает /auth/me с устаревшей кукой: ответ 200, context.businessId пуст, значит указатель устарел
      const me = await w.call('H1_MGR', 'get', '/auth/me', { scope: stale });
      expect(me.status).toBe(200);
      expect(
        (me.json as { context?: { businessId?: string | null } }).context?.businessId ?? null,
      ).toBeNull();
      // 2. /scope/resolve снимает куку и спрашивает /branches: у ограниченного там только назначенный филиал
      const branches = await w.call('H1_MGR', 'get', '/branches');
      expect(branches.status).toBe(200);
      const items = (
        branches.json as { items: Array<{ locationId: string; location: { businessId: string } }> }
      ).items;
      expect(items.map((i) => i.locationId)).toEqual([w.ids.h1]);
      // 3. выбор из ответа сервера работает
      const chosen = `business=${items[0]!.location.businessId};location=${items[0]!.locationId}`;
      const tasks = await w.call('H1_MGR', 'get', '/tasks', { scope: chosen });
      expect(tasks.status).toBe(200);
      expect(tasks.tokens).toEqual(['S2P1']);
    });

    it('публичный маршрут не ломается из-за мусорного заголовка', async () => {
      const r = await w.call('ORG_MGR', 'get', '/auth/options', { scope: 'garbage' });
      expect(r.status).toBe(200);
    });

    it('403 несёт понятный русский текст', async () => {
      const r = await w.call('OWNER', 'get', '/tasks', { scope: 'garbage' });
      expect(r.status).toBe(403);
      expect(r.text).toContain('Выберите филиал заново');
    });
  },
);
