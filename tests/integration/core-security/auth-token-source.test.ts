/**
 * Единый контур входа (16.10.2026): замок API (`SessionGuard`, `RoleGuard`) читает ключ из заголовков, а контроллер учётных
 * записей до исправления читал сначала куку. Человек с двумя своими сессиями (ограниченная в организации A кукой и
 * неограниченная в организации B заголовком) мог бы пройти замок по сессии B, а действие выполнить от сессии A. Проверка
 * 16.10.2026 показала, что это не проходит: контекст RLS берётся из сессии замка, и чужая по организации строка сессии
 * сервису учётных записей не видна (401). Тест закрепляет это поведение как регрессию: в организации A приглашения нет.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashSessionToken, newSessionToken } from '@pms/domain';
import { buildScopeWorld, type ScopeWorld } from './scope-world';

describe.skipIf(!process.env.DATABASE_URL)('accounts routes act on the session the guard checked', () => {
  let w: ScopeWorld;
  beforeAll(async () => {
    w = await buildScopeWorld();
  }, 180_000);
  afterAll(async () => {
    if (w) {
      await w.db.invite.deleteMany({ where: { organizationId: { in: [w.ids.orgA!, w.ids.orgB!] } } });
      await w.db.membership.deleteMany({ where: { organizationId: w.ids.orgB!, role: 'MANAGER' } });
    }
    await w?.close();
  }, 60_000);

  it('restricted cookie session in A plus unrestricted header session in B cannot invite into A', async () => {
    const me = await w.db.user.findUniqueOrThrow({ where: { email: `s2-h1mgr-${w.ids.m}@example.invalid` } });
    // тот же человек законно состоит и в организации B, без ограничений
    await w.db.membership.create({ data: { userId: me.id, organizationId: w.ids.orgB!, role: 'MANAGER' } });
    const headerToken = newSessionToken();
    await w.db.session.create({
      data: {
        userId: me.id, organizationId: w.ids.orgB!, tokenHash: hashSessionToken(headerToken),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });
    const restrictedA = w.tokens.H1_MGR;
    const email = `smuggled-${randomUUID()}@example.invalid`;

    // запрос через стенд (`listen(0, '127.0.0.1')`): заголовок ключа подменён на сессию B, кука несёт сессию A
    const res = await w.call('H1_MGR', 'post', '/auth/invites', {
      headers: { Authorization: `Bearer ${headerToken}`, Cookie: `wetop_session=${restrictedA}` },
      body: { email, role: 'STAFF' },
    });
    // Сейчас защищает RLS: запрос идёт в организации сессии из заголовка (B), и строка сессии A ему не видна.
    expect(res.status, res.text.slice(0, 200)).toBe(401);

    expect(await w.db.invite.count({ where: { organizationId: w.ids.orgA!, email } })).toBe(0);
  });
});
