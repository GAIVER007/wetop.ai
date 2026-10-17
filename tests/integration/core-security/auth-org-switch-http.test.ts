/**
 * Единый контур входа (16.10.2026), цепочка Ж по HTTP с настоящими замками и RLS: человек из организации B, принятый в A,
 * переходит в A через `POST /auth/organization`. Прежний ключ гаснет, данные B после перехода не приходят даже с
 * устаревшим указателем филиала B, чужой номер организации отклоняется.
 */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
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

  const http = () => request(w.app.getHttpServer());

  it('switches into an organization the person belongs to and never mixes data of the previous one', async () => {
    const foreign = await w.db.user.findUniqueOrThrow({ where: { email: `s2-foreign-${w.ids.m}@example.invalid` } });
    const oldToken = w.tokens.FOREIGN;

    // до приглашения номер A для него чужой
    const denied = await http().post('/auth/organization').set('Authorization', `Bearer ${oldToken}`)
      .send({ organizationId: w.ids.orgA! });
    expect(denied.status).toBe(403);
    const junk = await http().post('/auth/organization').set('Authorization', `Bearer ${oldToken}`)
      .send({ organizationId: randomUUID() });
    expect(junk.status).toBe(403);

    await w.db.membership.create({ data: { userId: foreign.id, organizationId: w.ids.orgA!, role: 'STAFF' } });
    const list = await http().get('/auth/organizations').set('Authorization', `Bearer ${oldToken}`);
    expect(list.status).toBe(200);
    expect((list.body.organizations as Array<{ id: string }>).map((o) => o.id).sort())
      .toEqual([w.ids.orgA!, w.ids.orgB!].sort());

    // устаревший указатель филиала B уходит вместе с запросом перехода (вкладка ещё помнит B)
    const switched = await http().post('/auth/organization').set('Authorization', `Bearer ${oldToken}`)
      .set('X-Wetop-Scope', `business=${w.ids.hotB!};location=${w.ids.hB!}`)
      .send({ organizationId: w.ids.orgA! });
    expect(switched.status, switched.text.slice(0, 160)).toBe(201);
    const token = switched.body.token as string;

    const meOld = await http().get('/auth/me').set('Authorization', `Bearer ${oldToken}`);
    expect(meOld.body.user ?? null).toBeNull();
    const me = await http().get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.body.user.organizationId).toBe(w.ids.orgA!);
    expect(me.body.user.role).toBe('STAFF');

    // поздний запрос со старым указателем B в новой сессии: отказ, а не данные B
    const stale = await http().get('/branches').set('Authorization', `Bearer ${token}`)
      .set('X-Wetop-Scope', `business=${w.ids.hotB!};location=${w.ids.hB!}`);
    expect(tokensIn(stale.text)).not.toContain('S2ORGB');
    const branches = await http().get('/branches').set('Authorization', `Bearer ${token}`);
    expect(branches.status).toBe(200);
    expect(tokensIn(branches.text)).not.toContain('S2ORGB');
  });
});
