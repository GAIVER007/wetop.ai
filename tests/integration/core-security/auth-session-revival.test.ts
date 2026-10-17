/**
 * Единый контур входа (16.10.2026), цепочка И: отозванный доступ не возвращается сам. До исправления отключение сотрудника и
 * архив организации гасили сессии только проверкой на каждом запросе, а строки сессий оставались живыми. Повторное
 * приглашение того же человека (или возврат организации из архива) в течение 12 часов оживляло старые ключи: украденный
 * или забытый на чужом устройстве ключ снова пускал. Приостановка (§31.2) так уже делала, здесь то же для двух других путей.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashSessionToken } from '@pms/domain';
import { PrismaExtensionsRepository } from '../../../apps/api/src/platform/extensions.repository';
import { buildScopeWorld, type ScopeWorld } from './scope-world';

describe.skipIf(!process.env.DATABASE_URL)('revoked access stays revoked after re-grant', () => {
  let w: ScopeWorld;
  beforeAll(async () => {
    w = await buildScopeWorld();
  }, 180_000);
  afterAll(async () => {
    await w?.close();
  }, 60_000);

  // ключ задаётся явно: стенд подставляет в заголовок любой переданный ключ (`listen(0, '127.0.0.1')` внутри стенда)
  const me = async (token: string) => {
    const r = await w.call('OWNER', 'get', '/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    return { body: r.json as { user: unknown } };
  };
  const sessionRow = (token: string) =>
    w.db.session.findUniqueOrThrow({ where: { tokenHash: hashSessionToken(token) } });

  it('removed member re-invited: the old session key does not come back', async () => {
    const staff = await w.db.user.findUniqueOrThrow({ where: { email: `s2-orgstaff-${w.ids.m}@example.invalid` } });
    const old = w.tokens.ORG_STAFF;
    expect((await me(old)).body.user).not.toBeNull();

    const removed = await w.call('OWNER', 'delete', `/auth/members/${staff.id}`);
    expect(removed.status, removed.text.slice(0, 160)).toBe(200);
    expect((await sessionRow(old)).revokedAt).not.toBeNull();

    // повторное приглашение принято: членство снова есть (как его заводит принятие приглашения)
    await w.db.membership.create({ data: { userId: staff.id, organizationId: w.ids.orgA!, role: 'STAFF' } });
    expect((await me(old)).body.user ?? null).toBeNull();
  });

  it('organization archived and restored: sessions issued before the archive stay dead', async () => {
    const old = w.tokens.FOREIGN;
    expect((await me(old)).body.user).not.toBeNull();
    const repo = new PrismaExtensionsRepository({ db: w.db } as never);
    await repo.archive({ organizationId: w.ids.orgB!, by: null, now: new Date() });
    expect((await sessionRow(old)).revokedAt).not.toBeNull();
    await repo.restore({ organizationId: w.ids.orgB!, by: null, now: new Date() });
    expect((await me(old)).body.user ?? null).toBeNull();
  });
});
