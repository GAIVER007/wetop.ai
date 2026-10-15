/**
 * CORE-SECURITY-FIX-01 / O3=A: гости гостиницы (`Guest`, ключ только `organizationId`) остаются ОРГАНИЗАЦИОННЫМИ, ограниченному
 * сотруднику (с назначениями) данные гостей закрыты, неограниченным (владелец, менеджер и администратор без назначений) открыты
 * как раньше. Форма: тест утверждает БЕЗОПАСНОЕ поведение (красный на коде до исправления). Решение O3=A не вводит ни ключа
 * филиала, ни видимости гостя через его брони.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
const DOC = '33333333-3333-4333-8333-333333333333';
const GUEST_TOKENS = ['S2GH1', 'S2GH2', 'S2GH3', 'S2GORGB'];

describe.skipIf(!ENABLED)(
  'O3=A: гости организационные, ограниченному закрыты (HTTP + настоящая база + RLS)',
  () => {
    let w: ScopeWorld;
    beforeAll(async () => {
      w = await buildScopeWorld();
    }, 180_000);
    afterAll(async () => {
      await w?.close();
    }, 60_000);

    const guestId = (key: 'gH1' | 'gH2' | 'gH3' | 'gForeign') => w.ids[key]!;
    const routesFor = (
      id: string,
    ): Array<['get' | 'post' | 'patch' | 'delete', string, object?]> => [
      ['get', '/guests?q=S2GH'],
      ['get', '/guests/directory?pageSize=100'],
      ['get', '/guests/birthdays?from=2030-01-01&days=31'],
      ['get', `/guests/${id}`],
      ['get', `/guests/${id}/preview`],
      ['patch', `/guests/${id}`, { citizenship: 'KAZ' }],
      ['post', `/guests/${id}/documents`, { type: 'PASSPORT', number: 'S2-0001' }],
      ['delete', `/guests/${id}/documents/${DOC}`],
    ];

    it.each(RESTRICTED as readonly UserKey[])(
      '%s (ограничен): список, поиск, справочник, дни рождения, карточка, превью, правка и документы любого гостя дают 403',
      async (user) => {
        const failed: string[] = [];
        for (const scope of [OWN_SCOPE[user]!, 'NONE'] as ScopeKey[])
          for (const key of ['gH1', 'gH2', 'gH3', 'gForeign'] as const)
            for (const [method, path, body] of routesFor(guestId(key))) {
              const r = await w.call(user, method, path, { scope, ...(body ? { body } : {}) });
              if (r.status !== 403)
                failed.push(
                  `${scope} ${method.toUpperCase()} ${path} -> ${r.status} ${r.text.slice(0, 80)}`,
                );
              if (GUEST_TOKENS.some((t) => r.text.includes(t)))
                failed.push(`${method} ${path}: в ответе данные гостя`);
            }
        expect(failed, 'маршруты гостей, открытые ограниченному').toEqual([]);
      },
      180_000,
    );

    it('G-1 (c) STAFF филиала H1 не читает карточку гостя другого филиала H2 (в ответе нет ни имени, ни почты, ни заметок)', async () => {
      const r = await w.call('H1_STAFF', 'get', `/guests/${guestId('gH2')}`, { scope: 'HOT+H1' });
      expect(r.status).toBe(403);
      expect(r.text).not.toContain('S2GH2');
      expect(r.text).not.toContain('secret note');
    });

    it('G-2 (b) менеджер филиала H1 не читает гостя другого БИЗНЕСА организации (hot2)', async () => {
      const r = await w.call('H1_MGR', 'get', `/guests/${guestId('gH3')}`, { scope: 'HOT+H1' });
      expect(r.status).toBe(403);
      expect(r.text).not.toContain('S2GH3');
    });

    it('G-3 превью с долгами гостя другого филиала закрыто', async () => {
      const r = await w.call('H1_MGR', 'get', `/guests/${guestId('gH2')}/preview`, {
        scope: 'HOT+H1',
      });
      expect(r.status).toBe(403);
    });

    it('G-4/G-5 поиск и справочник не находят гостей чужих филиалов без знания UUID', async () => {
      const search = await w.call('H1_STAFF', 'get', '/guests?q=S2GH2', { scope: 'HOT+H1' });
      const directory = await w.call('H1_STAFF', 'get', '/guests/directory?pageSize=100', {
        scope: 'HOT+H1',
      });
      expect({ search: search.status, directory: directory.status }).toEqual({
        search: 403,
        directory: 403,
      });
      expect(search.text + directory.text).not.toContain(guestId('gH2'));
    });

    it('G-6 запись: администратор ограниченного филиала не правит гостя другого филиала, данные не меняются', async () => {
      const r = await w.call('H1_STAFF', 'patch', `/guests/${guestId('gH2')}`, {
        scope: 'HOT+H1',
        body: { citizenship: 'KAZ' },
      });
      expect(r.status).toBe(403);
      const row = await w.db.guest.findUniqueOrThrow({ where: { id: guestId('gH2') } });
      expect(row.citizenship).toBeNull();
    });

    it('403 несёт понятный русский текст', async () => {
      const r = await w.call('H1_MGR', 'get', '/guests/directory', { scope: 'HOT+H1' });
      expect(r.status).toBe(403);
      expect(r.text).toContain('без ограничения по филиалам');
    });

    it('G-7 (a) чужая организация: гость по явному id не найден, ни читать, ни править', async () => {
      const read = await w.call('OWNER', 'get', `/guests/${guestId('gForeign')}`, {
        scope: 'HOT+H1',
      });
      const write = await w.call('OWNER', 'patch', `/guests/${guestId('gForeign')}`, {
        scope: 'HOT+H1',
        body: { citizenship: 'KAZ' },
      });
      expect({ read: read.status, write: write.status }).toEqual({ read: 404, write: 404 });
      // и обратное направление: владелец чужой организации не видит гостей организации A
      const back = await w.call('FOREIGN', 'get', `/guests/${guestId('gH2')}`);
      expect(back.status).toBe(404);
      const search = await w.call('FOREIGN', 'get', '/guests?q=S2GH');
      expect(search.tokens).toEqual([]);
      expect(GUEST_TOKENS.filter((t) => t !== 'S2GORGB').some((t) => search.text.includes(t))).toBe(
        false,
      );
    });

    it('бронь существующему гостю (guestId) закрыта ограниченному: чужой гость не прикрепляется к его броне', async () => {
      const body = {
        source: 'WALK_IN',
        arrivalDate: '2030-02-01',
        departureDate: '2030-02-03',
        guestId: guestId('gH2'),
        items: [{ accommodationTypeCode: 'S2-NONE', ratePlanCode: 'S2-NONE', adults: 1 }],
      };
      const restricted = await w.call('H1_MGR', 'post', '/reservations/quote', {
        scope: 'HOT+H1',
        body,
      });
      expect(restricted.status, restricted.text.slice(0, 160)).toBe(403);
      expect(restricted.text).toContain('без ограничения по филиалам');
      // контроль: менеджер без назначений до проверки гостя доходит (отказ уже по тарифу или номеру, не по доступу)
      const control = await w.call('ORG_MGR', 'post', '/reservations/quote', {
        scope: 'HOT+H1',
        body,
      });
      expect(control.status, control.text.slice(0, 160)).not.toBe(403);
    });

    it('бронь с НОВЫМ гостем ограниченному по-прежнему доступна до проверки тарифа (создание своего гостя не закрыто)', async () => {
      const body = {
        source: 'WALK_IN',
        arrivalDate: '2030-02-01',
        departureDate: '2030-02-03',
        guest: { firstName: 'Test', lastName: 'S2NEWGUEST' },
        items: [{ accommodationTypeCode: 'S2-NONE', ratePlanCode: 'S2-NONE', adults: 1 }],
      };
      const r = await w.call('H1_MGR', 'post', '/reservations/quote', { scope: 'HOT+H1', body });
      expect(r.status, r.text.slice(0, 160)).not.toBe(403);
    });

    it('/system/pii-storage (режим хранения, не данные гостей) открыт ограниченному в своём месте', async () => {
      const r = await w.call('H1_STAFF', 'get', '/system/pii-storage', { scope: 'HOT+H1' });
      expect(r.status).toBe(200);
    });

    // ── контроль: поведение для неограниченных не изменилось ───────────────────────────────────────────

    it.each(UNRESTRICTED as readonly UserKey[])(
      'контроль: %s (без назначений) читает карточку, превью, поиск и справочник гостей всей организации',
      async (user) => {
        for (const key of ['gH1', 'gH2', 'gH3'] as const) {
          const card = await w.call(user, 'get', `/guests/${guestId(key)}`, { scope: 'HOT+H1' });
          const preview = await w.call(user, 'get', `/guests/${guestId(key)}/preview`, {
            scope: 'HOT+H1',
          });
          expect({ key, card: card.status, preview: preview.status }).toEqual({
            key,
            card: 200,
            preview: 200,
          });
        }
        const search = await w.call(user, 'get', '/guests?q=S2GH', { scope: 'HOT+H1' });
        const directory = await w.call(user, 'get', '/guests/directory?pageSize=100', {
          scope: 'HOT+H1',
        });
        const birthdays = await w.call(user, 'get', '/guests/birthdays?from=2030-01-01&days=31', {
          scope: 'HOT+H1',
        });
        expect({
          search: search.status,
          directory: directory.status,
          birthdays: birthdays.status,
        }).toEqual({
          search: 200,
          directory: 200,
          birthdays: 200,
        });
        expect(search.text).toContain(guestId('gH2'));
        expect(directory.text).toContain(guestId('gH3'));
      },
    );

    it('контроль: владелец без назначений правит гостя (гражданство) и без указателя работает так же', async () => {
      const r = await w.call('OWNER', 'patch', `/guests/${guestId('gH1')}`, {
        scope: 'HOT+H1',
        body: { citizenship: 'KAZ' },
      });
      expect(r.status, r.text.slice(0, 120)).toBe(200);
      const none = await w.call('ORG_MGR', 'get', `/guests/${guestId('gH1')}`);
      expect(none.status).toBe(200);
    });
  },
);
