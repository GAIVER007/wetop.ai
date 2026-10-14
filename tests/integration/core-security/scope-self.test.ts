/**
 * CORE-SECURITY-FIX-01 / A3, F6: самообслуживаемые (`@Access('self')`) маршруты. Для `self` перехватчик не проверяет место, и
 * указатель на место БЕЗ назначения отдавал данные этого места: черновик онбординга чужого филиала (`GET /onboarding`) и
 * названия самого раннего бизнеса и филиала организации (`GET /auth/registration-context`). Форма: тест утверждает БЕЗОПАСНОЕ
 * поведение (красный на коде до исправления). `/auth/me` обязан работать: по нему стойка восстанавливает указатель.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildScopeWorld,
  OWN_SCOPE,
  RESTRICTED,
  UNRESTRICTED,
  type ScopeWorld,
  type UserKey,
} from './scope-world';

const ENABLED = !!process.env.DATABASE_URL;

describe.skipIf(!ENABLED)(
  'A3/F6: self-маршруты не отдают данные места без назначения (HTTP + настоящая база + RLS)',
  () => {
    let w: ScopeWorld;
    beforeAll(async () => {
      w = await buildScopeWorld();
    }, 180_000);
    afterAll(async () => {
      await w?.close();
    }, 60_000);

    // ── GET /onboarding ─────────────────────────────────────────────────────────────────────────────

    it('T11 менеджер ресторана с указателем на гостиничный филиал H2 не читает его черновик онбординга', async () => {
      const r = await w.call('FOO_MGR', 'get', '/onboarding', { scope: 'HOT+H2' });
      expect(r.status, r.text.slice(0, 160)).toBe(403);
      expect(r.text).not.toContain('S2SECRETDRAFT');
    });

    it.each(['H1_MGR', 'H1_STAFF', 'HOT2_MGR', 'BEA_MGR', 'BEA_LOC_STAFF'] as const)(
      '%s с указателем на H2 (место без назначения) не получает черновик H2',
      async (user) => {
        const r = await w.call(user, 'get', '/onboarding', { scope: 'HOT+H2' });
        expect(r.status, r.text.slice(0, 160)).toBe(403);
        expect(r.text).not.toContain('S2SECRETDRAFT');
      },
    );

    it.each(['H2_MGR', 'H2_STAFF', 'HOT_MGR'] as const)(
      'контроль: %s открывает черновик своего места H2 (назначение есть)',
      async (user) => {
        const r = await w.call(user, 'get', '/onboarding', { scope: 'HOT+H2' });
        expect(r.status, r.text.slice(0, 160)).toBe(200);
        expect(r.text).toContain('S2SECRETDRAFT');
      },
    );

    it('контроль: ограниченный без указателя получает отказ «выберите филиал», а не данные (как и раньше)', async () => {
      const r = await w.call('H1_MGR', 'get', '/onboarding');
      expect(r.status).toBe(403);
    });

    it.each(UNRESTRICTED as readonly UserKey[])(
      'контроль: %s (без назначений) читает онбординг любого своего филиала, как раньше',
      async (user) => {
        const r = await w.call(user, 'get', '/onboarding', { scope: 'HOT+H2' });
        expect(r.status).toBe(200);
        expect(r.text).toContain('S2SECRETDRAFT');
      },
    );

    it('чужая организация: черновик H2 недоступен ни по какому указателю', async () => {
      const r = await w.call('FOREIGN', 'get', '/onboarding', { scope: 'HOT+H2' });
      expect(r.text).not.toContain('S2SECRETDRAFT');
    });

    // ── GET /auth/registration-context ──────────────────────────────────────────────────────────────

    it('T12 менеджер ресторана получает свой бизнес и филиал, а не названия самого раннего бизнеса организации', async () => {
      const r = await w.call('FOO_MGR', 'get', '/auth/registration-context', { scope: 'FOO+LF' });
      expect(r.status).toBe(200);
      expect(r.text).not.toContain('Luxx Aparts');
      expect(r.text).not.toContain('S2P1');
      expect(r.json).toMatchObject({
        businessId: w.ids.foo,
        locationId: w.ids.lf,
        vertical: 'FOOD_SERVICE',
      });
    });

    it.each([
      ['BEA_MGR', 'bea', 'lb'],
      ['BEA_LOC_STAFF', 'bea', 'lb'],
      ['H1_MGR', 'hot', 'h1'],
      ['H1_STAFF', 'hot', 'h1'],
      ['H2_MGR', 'hot', 'h2'],
      ['H2_STAFF', 'hot', 'h2'],
      ['HOT_MGR', 'hot', 'h1'],
      ['HOT2_MGR', 'hot2', 'h3'],
    ] as const)(
      '%s: контекст регистрации только из его назначений (%s, %s)',
      async (user, business, location) => {
        for (const scope of [OWN_SCOPE[user]!, 'NONE'] as const) {
          const r = await w.call(user, 'get', '/auth/registration-context', { scope });
          expect(r.status).toBe(200);
          expect(r.json, `${user} ${scope}`).toMatchObject({
            businessId: w.ids[business],
            locationId: w.ids[location],
          });
        }
      },
    );

    it('H2_MGR не получает название филиала H1, хотя H1 в организации самый ранний', async () => {
      const r = await w.call('H2_MGR', 'get', '/auth/registration-context');
      expect(r.text).not.toContain('Luxx Aparts');
      expect(r.text).toContain('S2P2');
    });

    it.each(UNRESTRICTED as readonly UserKey[])(
      'контроль: %s (без назначений) по-прежнему получает самый ранний бизнес и филиал организации',
      async (user) => {
        const r = await w.call(user, 'get', '/auth/registration-context');
        expect(r.status).toBe(200);
        expect(r.json).toMatchObject({
          businessId: w.ids.hot,
          locationId: w.ids.h1,
          vertical: 'HOSPITALITY',
        });
      },
    );

    // ── /auth/me: нужен вебу для восстановления указателя, ломать нельзя ─────────────────────────────

    it.each([...RESTRICTED, ...UNRESTRICTED, 'FOREIGN'] as readonly UserKey[])(
      '/auth/me отвечает 200 и с чужим, и с битым, и с устаревшим указателем (%s)',
      async (user) => {
        const headers = [
          // указатель чужой организации (для владельца организации B чужая — организация A)
          user === 'FOREIGN'
            ? `business=${w.ids.hot};location=${w.ids.h1}`
            : `business=${w.ids.hotB};location=${w.ids.hB}`,
          'garbage',
          `business=${w.ids.bea};location=${w.ids.h1}`, // филиал не из этого бизнеса
          `location=${w.ids.lf}`, // филиал без бизнеса
        ];
        for (const scope of headers) {
          const r = await w.call(user, 'get', '/auth/me', { scope });
          expect(r.status, `${user} ${scope}`).toBe(200);
          // отклонённый указатель стойка видит по пустому context.businessId и сбрасывает через /scope/resolve
          expect(
            (r.json as { context?: { businessId?: string | null } }).context?.businessId ?? null,
          ).toBeNull();
        }
      },
    );

    it.each([
      ['H1_MGR', 'HOT+H2'], // существующий активный филиал организации, но не назначенный
      ['H1_STAFF', 'HOT2+H3'], // филиал другого бизнеса организации
      ['BEA_MGR', 'HOT+H1'],
      ['FOO_MGR', 'BEA+LB'],
    ] as const)(
      'восстановление: /auth/me %s с указателем %s (место без назначения) не подтверждает выбор, стойка ведёт на выбор филиала',
      async (user, scope) => {
        const r = await w.call(user, 'get', '/auth/me', { scope });
        expect(r.status).toBe(200);
        const body = r.json as {
          context?: { businessId?: string | null; locationId?: string | null };
          user?: { restricted?: boolean };
        };
        expect(body.user?.restricted).toBe(true);
        expect(body.context?.businessId ?? null).toBeNull();
        expect(body.context?.locationId ?? null).toBeNull();
      },
    );

    it.each([
      ['H1_MGR', 'HOT+H1'],
      ['H2_STAFF', 'HOT+H2'],
      ['HOT_MGR', 'HOT+H2'], // назначен на весь бизнес: любой его филиал свой
      ['BEA_LOC_STAFF', 'BEA+LB'],
      ['ORG_MGR', 'HOT+H2'],
      ['OWNER', 'HOT2+H3'],
    ] as const)(
      '/auth/me %s с указателем %s подтверждает назначенное или свободное место, как раньше',
      async (user, scope) => {
        const r = await w.call(user, 'get', '/auth/me', { scope });
        expect(r.status).toBe(200);
        const body = r.json as { context?: { businessId?: string | null } };
        expect(body.context?.businessId).toBeTruthy();
      },
    );
  },
);
