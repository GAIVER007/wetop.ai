/**
 * Единый контур входа (16.10.2026), цепочка Ж по HTTP с настоящими замками и RLS: человек из организации B, принятый в A,
 * переходит в A через `POST /auth/organization`. Прежний ключ гаснет, данные B после перехода не приходят даже с
 * устаревшим указателем филиала B, чужой номер организации отклоняется.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildScopeWorld, tokensIn, type ScopeWorld } from './scope-world';

describe.skipIf(!process.env.DATABASE_URL)('organization switch over HTTP', () => {
  let w: ScopeWorld;
  beforeAll(async () => {
    w = await buildScopeWorld();
  }, 180_000);
  afterAll(async () => {
    await w?.close();
  }, 60_000);

  // запросы через стенд (`listen(0, '127.0.0.1')`); ключ и указатель филиала задаются явно
  const as = (token: string, method: 'get' | 'post', path: string, extra: { scope?: string; body?: unknown } = {}) =>
    w.call('FOREIGN', method, path, {
      headers: { Authorization: `Bearer ${token}`, ...(extra.scope ? { 'X-Wetop-Scope': extra.scope } : {}) },
      ...(extra.body !== undefined ? { body: extra.body } : {}),
    });

  it('switches into an organization the person belongs to and never mixes data of the previous one', async () => {
    const foreign = await w.db.user.findUniqueOrThrow({ where: { email: `s2-foreign-${w.ids.m}@example.invalid` } });
    const oldToken = w.tokens.FOREIGN;

    // до приглашения номер A для него чужой
    const denied = await as(oldToken, 'post', '/auth/organization', { body: { organizationId: w.ids.orgA! } });
    expect(denied.status).toBe(403);
    const junk = await as(oldToken, 'post', '/auth/organization', { body: { organizationId: randomUUID() } });
    expect(junk.status).toBe(403);

    await w.db.membership.create({ data: { userId: foreign.id, organizationId: w.ids.orgA!, role: 'STAFF' } });
    const list = await as(oldToken, 'get', '/auth/organizations');
    expect(list.status).toBe(200);
    expect((list.json as { organizations: Array<{ id: string }> }).organizations.map((o) => o.id).sort())
      .toEqual([w.ids.orgA!, w.ids.orgB!].sort());

    // устаревший указатель филиала B уходит вместе с запросом перехода (вкладка ещё помнит B)
    const switched = await as(oldToken, 'post', '/auth/organization', {
      scope: `business=${w.ids.hotB!};location=${w.ids.hB!}`,
      body: { organizationId: w.ids.orgA! },
    });
    expect(switched.status, switched.text.slice(0, 160)).toBe(201);
    const token = (switched.json as { token: string }).token;

    const meOld = await as(oldToken, 'get', '/auth/me');
    expect((meOld.json as { user: unknown }).user ?? null).toBeNull();
    const me = (await as(token, 'get', '/auth/me')).json as { user: { organizationId: string; role: string } };
    expect(me.user.organizationId).toBe(w.ids.orgA!);
    expect(me.user.role).toBe('STAFF');

    // поздний запрос со старым указателем B в новой сессии: отказ, а не данные B
    const stale = await as(token, 'get', '/branches', { scope: `business=${w.ids.hotB!};location=${w.ids.hB!}` });
    expect(tokensIn(stale.text)).not.toContain('S2ORGB');
    const branches = await as(token, 'get', '/branches');
    expect(branches.status).toBe(200);
    expect(tokensIn(branches.text)).not.toContain('S2ORGB');
  });
});
