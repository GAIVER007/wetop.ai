import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { hashPassword, hashSessionToken, newSessionToken, verifyPassword } from '@pms/domain';
import { AuthModule } from '../../apps/api/src/auth/auth.module';
import { AuthService } from '../../apps/api/src/auth/auth.service';
import { SessionGuard } from '../../apps/api/src/auth/auth.guard';
import { APP_URL, MAILER } from '../../apps/api/src/auth/password-reset.service';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { PLATFORM_MAILER } from '../../apps/api/src/platform/organization-creation';
import { purgeAuditRows } from '../tools/audit-purge';

// No dotenv or remote fallback: this regression is destructive only to its own synthetic fixtures.
const url = process.env.DATABASE_URL;
const password = () => `Synthetic-${randomUUID()}!`;

describe('password reset over real AuthModule HTTP and PostgreSQL', () => {
  let db: Db;
  let app: INestApplication;
  const users: string[] = [];
  const orgs: string[] = [];
  const mailbox: Array<{ to: string; text: string }> = [];
  let readGate: { remaining: number; arrived: () => void; release: Promise<void> } | undefined;
  let loginGate: { userId: string; arrived: () => void; release: Promise<void> } | undefined;
  let issuanceGate: { userId: string; arrived: () => void; release: Promise<void> } | undefined;

  beforeAll(async () => {
    if (!url || new URL(url).hostname !== '127.0.0.1' || process.env.DATABASE_SCHEMA !== 'pms_test')
      throw new Error('This regression requires isolated localhost PostgreSQL and pms_test');
    vi.stubEnv('AUTH_REQUIRED', '1');
    db = createPrismaClient(url);
    expect(await db.$queryRaw`SELECT current_schema() AS schema`).toEqual([{ schema: 'pms_test' }]);
    // Real reads still execute in PostgreSQL. The gate only holds their returned snapshots
    // until both HTTP requests have read the unused token, removing scheduler luck.
    const observed = db.$extends({ query: { passwordReset: {
      async findUnique({ args, query }) {
        const row = await query(args);
        const gate = readGate;
        if (gate && --gate.remaining === 0) gate.arrived();
        if (gate) await gate.release;
        return row;
      },
    }, user: {
      async update({ args, query }) {
        const gate = loginGate;
        if (gate && args.where.id === gate.userId && args.data.lastLoginAt) {
          gate.arrived();
          await gate.release;
        }
        return query(args);
      },
      async updateMany({ args, query }) {
        const gate = loginGate;
        if (gate && args.where?.id === gate.userId && args.data.lastLoginAt) {
          gate.arrived();
          await gate.release;
        }
        return query(args);
      },
    }, session: {
      async create({ args, query }) {
        const gate = issuanceGate;
        if (gate && args.data.userId === gate.userId) {
          gate.arrived();
          await gate.release;
        }
        return query(args);
      },
    } } });
    const module = await Test.createTestingModule({ imports: [AuthModule] })
      .overrideProvider(PrismaService).useValue({ db: observed })
      .overrideProvider(MAILER).useValue({ async send(letter: { to: string; text: string }) { mailbox.push(letter); } })
      .overrideProvider(PLATFORM_MAILER).useValue(null)
      .overrideProvider(APP_URL).useValue('https://reset.example.invalid')
      .compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalGuards(new SessionGuard(app.get(Reflector), app.get(AuthService)));
    await app.listen(0, '127.0.0.1');
  });

  afterEach(() => { readGate = undefined; loginGate = undefined; issuanceGate = undefined; });
  afterAll(async () => {
    if (app) await app.close();
    if (db) {
      await purgeAuditRows(db, { userId: { in: users } });
      await db.passwordReset.deleteMany({ where: { userId: { in: users } } });
      await db.session.deleteMany({ where: { userId: { in: users } } });
      await db.membership.deleteMany({ where: { userId: { in: users } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
      await db.organization.deleteMany({ where: { id: { in: orgs } } });
      await db.$disconnect();
    }
    vi.unstubAllEnvs();
  });

  async function fixture() {
    const id = randomUUID();
    const organizationId = randomUUID();
    users.push(id); orgs.push(organizationId);
    const email = `reset-${id}@example.invalid`;
    const oldPassword = password();
    await db.organization.create({ data: { id: organizationId, name: `Reset fixture ${organizationId}`, status: 'ACTIVE' } });
    await db.user.create({ data: { id, email, passwordHash: hashPassword(oldPassword), emailVerifiedAt: new Date() } });
    await db.membership.create({ data: { userId: id, organizationId, role: 'OWNER' } });
    await request(app.getHttpServer()).post('/auth/password-reset/request').send({ email }).expect(201);
    const text = mailbox.find((l) => l.to === email)?.text ?? '';
    const token = new URL(text.match(/https:\/\/\S+/)?.[0] ?? '').searchParams.get('token')!;
    expect(Boolean(token)).toBe(true);
    const reset = await db.passwordReset.findUniqueOrThrow({ where: { tokenHash: hashSessionToken(token) } });
    return { id, organizationId, email, oldPassword, token, reset };
  }
  const confirm = (token: string, value = password()) => request(app.getHttpServer())
    .post('/auth/password-reset/confirm').send({ token, password: value });
  async function login(f: Awaited<ReturnType<typeof fixture>>, value = f.oldPassword) {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email: f.email, password: value }).expect(201);
    return response.body.token as string;
  }
  const me = (token: string) => request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${token}`);
  const changed = (id: string) => db.auditLog.findMany({ where: { userId: id, action: 'user.password.changed' } });

  function barrier(count: number) {
    let arrived!: () => void;
    let release!: () => void;
    const ready = new Promise<void>((resolve) => { arrived = resolve; });
    readGate = { remaining: count, arrived, release: new Promise<void>((resolve) => { release = resolve; }) };
    return { ready, release };
  }

  it('concurrent same-token HTTP confirms have exactly one winner, one password and one audit', async () => {
    const f = await fixture();
    const oldSession = await login(f);
    const candidates = [password(), password()];
    const gate = barrier(2);
    const responses = Promise.all(candidates.map((p) => confirm(f.token, p).then((r) => r)));
    try { await gate.ready; } finally { gate.release(); }
    const result = await responses;
    expect(result.map((r) => r.status).sort()).toEqual([201, 401]);
    const user = await db.user.findUniqueOrThrow({ where: { id: f.id } });
    const winner = result.findIndex((r) => r.status === 201);
    expect(verifyPassword(candidates[winner]!, user.passwordHash)).toBe(true);
    expect(verifyPassword(candidates[1 - winner]!, user.passwordHash)).toBe(false);
    expect((await changed(f.id)).length).toBe(1);
    expect((await db.passwordReset.findUniqueOrThrow({ where: { id: f.reset.id } })).usedAt).not.toBeNull();
    await me(oldSession).expect(401);
  }, 15_000);

  it('success revokes every live session across organizations, not another user or already-revoked time', async () => {
    const f = await fixture();
    const other = await fixture();
    const sessions = [await login(f), await login(f)];
    const otherSession = await login(other);
    const crossToken = newSessionToken();
    await db.membership.create({ data: { userId: f.id, organizationId: other.organizationId, role: 'STAFF' } });
    await db.session.create({ data: { userId: f.id, organizationId: other.organizationId, tokenHash: hashSessionToken(crossToken), expiresAt: new Date(Date.now() + 3_600_000) } });
    const prior = new Date('2025-01-01T00:00:00Z');
    const revoked = await db.session.create({ data: { userId: f.id, organizationId: f.organizationId, tokenHash: hashSessionToken(newSessionToken()), expiresAt: new Date(Date.now() + 3_600_000), revokedAt: prior } });
    await me(sessions[0]!).expect(200);
    await me(crossToken).expect(200);
    const value = password();
    await confirm(f.token, value).expect(201);
    for (const token of [...sessions, crossToken]) await me(token).expect(401);
    await me(otherSession).expect(200);
    expect(await db.session.count({ where: { userId: f.id, revokedAt: null } })).toBe(0);
    expect((await db.session.findUniqueOrThrow({ where: { id: revoked.id } })).revokedAt).toEqual(prior);
    expect((await changed(f.id))[0]?.after).toEqual({ by: 'link', sessionsRevoked: 3 });
    await login(f, value);
  });

  it.each(['sessions', 'audit_logs'] as const)('PostgreSQL failure in %s rolls back password, token, sessions and audit; token remains retryable', async (table) => {
    const f = await fixture();
    const session = await login(f);
    const before = await db.user.findUniqueOrThrow({ where: { id: f.id } });
    const name = `reset_fault_${randomUUID().replaceAll('-', '')}`;
    // Fixture-scoped database fault, not mocked persistence. Identifiers are generated hex only.
    await db.$executeRawUnsafe(`CREATE FUNCTION pms_test.${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.user_id = '${f.id}'::uuid THEN RAISE EXCEPTION 'synthetic reset regression fault'; END IF; RETURN NEW; END $$`);
    try {
      await db.$executeRawUnsafe(`CREATE TRIGGER ${name} BEFORE ${table === 'sessions' ? 'UPDATE' : 'INSERT'} ON pms_test.${table} FOR EACH ROW EXECUTE FUNCTION pms_test.${name}()`);
      await confirm(f.token).expect(500);
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${name} ON pms_test.${table}`);
      await db.$executeRawUnsafe(`DROP FUNCTION pms_test.${name}()`);
    }
    const after = await db.user.findUniqueOrThrow({ where: { id: f.id } });
    expect(after.passwordHash === before.passwordHash).toBe(true);
    expect(after.emailVerifiedAt).toEqual(before.emailVerifiedAt);
    expect(after.status).toBe(before.status);
    expect(after.failedAttempts).toBe(before.failedAttempts);
    expect(after.lockedUntil).toEqual(before.lockedUntil);
    expect((await db.passwordReset.findUniqueOrThrow({ where: { id: f.reset.id } })).usedAt).toBeNull();
    expect(await db.session.count({ where: { userId: f.id, revokedAt: null } })).toBe(1);
    expect(await changed(f.id)).toHaveLength(0);
    await me(session).expect(200);
    await confirm(f.token).expect(201);
    await me(session).expect(401);
  });

  it('sequential reuse cannot overwrite a successful password or add another audit', async () => {
    const f = await fixture();
    const value = password();
    await confirm(f.token, value).expect(201);
    await confirm(f.token).expect(401);
    const user = await db.user.findUniqueOrThrow({ where: { id: f.id } });
    expect(verifyPassword(value, user.passwordHash)).toBe(true);
    expect(await changed(f.id)).toHaveLength(1);
  });

  it.each(['expired', 'blocked', 'unknown', 'weak'] as const)('%s confirmation leaves password, token and sessions unchanged', async (kind) => {
    const f = await fixture();
    const session = await login(f);
    if (kind === 'expired') await db.passwordReset.update({ where: { id: f.reset.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });
    if (kind === 'blocked') await db.user.update({ where: { id: f.id }, data: { status: 'BLOCKED' } });
    const before = await db.user.findUniqueOrThrow({ where: { id: f.id } });
    await confirm(kind === 'unknown' ? newSessionToken() : f.token, kind === 'weak' ? 'short' : password()).expect(kind === 'weak' ? 400 : 401);
    const after = await db.user.findUniqueOrThrow({ where: { id: f.id } });
    expect(after.passwordHash === before.passwordHash).toBe(true);
    expect(after.status).toBe(before.status);
    expect((await db.passwordReset.findUniqueOrThrow({ where: { id: f.reset.id } })).usedAt).toBeNull();
    expect(await db.session.count({ where: { userId: f.id, revokedAt: null } })).toBe(1);
    expect(await changed(f.id)).toHaveLength(0);
    if (kind !== 'blocked') await me(session).expect(200);
  });

  it('blocking an account after the token read cannot reactivate it', async () => {
    const f = await fixture();
    const before = await db.user.findUniqueOrThrow({ where: { id: f.id } });
    const gate = barrier(1);
    const response = confirm(f.token).then((r) => r);
    try {
      await gate.ready;
      await db.user.update({ where: { id: f.id }, data: { status: 'BLOCKED' } });
    } finally { gate.release(); }
    expect((await response).status).toBe(401);
    const after = await db.user.findUniqueOrThrow({ where: { id: f.id } });
    expect(after.status).toBe('BLOCKED');
    expect(after.passwordHash === before.passwordHash).toBe(true);
    expect((await db.passwordReset.findUniqueOrThrow({ where: { id: f.reset.id } })).usedAt).toBeNull();
    expect(await changed(f.id)).toHaveLength(0);
  }, 15_000);

  it('a login verified with the old password cannot issue a live session after reset', async () => {
    const f = await fixture();
    let arrived!: () => void;
    let release!: () => void;
    const ready = new Promise<void>((resolve) => { arrived = resolve; });
    loginGate = { userId: f.id, arrived, release: new Promise<void>((resolve) => { release = resolve; }) };
    const pending = request(app.getHttpServer()).post('/auth/login')
      .send({ email: f.email, password: f.oldPassword }).then((r) => r);
    try {
      await ready;
      await confirm(f.token).expect(201);
    } finally { release(); }
    const response = await pending;
    expect(response.status).toBe(401);
    expect(await db.session.count({ where: { userId: f.id, revokedAt: null } })).toBe(0);
  }, 60_000);

  it('reset waits for an already-locked login issuance then revokes its session', async () => {
    const f = await fixture();
    let arrived!: () => void;
    let release!: () => void;
    const ready = new Promise<void>((resolve) => { arrived = resolve; });
    issuanceGate = { userId: f.id, arrived, release: new Promise<void>((resolve) => { release = resolve; }) };
    const pendingLogin = request(app.getHttpServer()).post('/auth/login')
      .send({ email: f.email, password: f.oldPassword }).then((r) => r);
    await ready;
    const value = password();
    const pendingReset = confirm(f.token, value).then((r) => r);
    try {
      const deadline = Date.now() + 10_000;
      let blocked = false;
      while (Date.now() < deadline) {
        const rows = await db.$queryRaw<Array<{ blocked: boolean }>>`
          SELECT EXISTS (SELECT 1 FROM pg_stat_activity
            WHERE datname = current_database() AND pid <> pg_backend_pid()
            AND wait_event_type = 'Lock' AND query LIKE '%users%') AS blocked`;
        if (rows[0]?.blocked) { blocked = true; break; }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true);
    } finally { release(); }
    const [signedIn, reset] = await Promise.all([pendingLogin, pendingReset]);
    expect(signedIn.status).toBe(201);
    expect(reset.status).toBe(201);
    await me(signedIn.body.token).expect(401);
    expect(await db.session.count({ where: { userId: f.id, revokedAt: null } })).toBe(0);
    await login(f, value);
  }, 60_000);
});
