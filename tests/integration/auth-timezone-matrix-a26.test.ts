import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { createPrismaClient } from '../../packages/database/src/index';
const parent = process.env.A28_WORK_DIR ?? process.env.A26_WORK_DIR;
const databaseHost = process.env.A28_PG_HOST ?? '127.0.0.1';
const databasePort = Number(process.env.A28_PG_PORT ?? '55601');
const migratorRole = process.env.A28_PG_MIGRATOR_ROLE ?? 'a24_migrator';
const databaseName = process.env.A28_PG_DATABASE ?? 'a26_auth';
const databaseIdentifier = pg.escapeIdentifier(databaseName);
const uri = (role: string) =>
  `postgresql://${role}@${databaseHost}:${databasePort}/${databaseName}`;
const api = (process.env.A28_API_URL ?? 'http://127.0.0.1:4427').replace(/\/$/, '');
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
describe.skipIf(!parent)('A26 timezone matrix, application roles and pools', () => {
  it('keeps epochs, HTTP expiry and tenant isolation across database defaults and process zones', async () => {
    const privateData = JSON.parse(readFileSync(`${parent}/a26-private.json`, 'utf8')) as {
      email: string;
      password: string;
      org: string;
      user: string;
    };
    const observer = new pg.Client({
      connectionString: uri(migratorRole),
      options: '-c search_path=pms_test,public',
    });
    await observer.connect();
    const proof: unknown[] = [];
    const login = async () => {
      const response = await fetch(`${api}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: privateData.email, password: privateData.password }),
      });
      expect(response.status).toBe(201);
      return ((await response.json()) as { token: string }).token;
    };
    const me = (token: string) =>
      fetch(`${api}/auth/me`, { headers: { authorization: `Bearer ${token}` } });
    try {
      for (const [zone, nodeZone] of [
        ['UTC', 'America/Los_Angeles'],
        ['America/Los_Angeles', 'UTC'],
        ['Asia/Dubai', 'UTC'],
        ['Asia/Kolkata', 'UTC'],
      ]) {
        await observer.query(`ALTER DATABASE ${databaseIdentifier} SET timezone='${zone}'`);
        execFileSync(process.execPath, [`${parent}/a26-restart.cjs`], {
          env: { ...process.env, A26_NODE_TZ: nodeZone, A26_INHERITED_SANDBOX: '1' },
          stdio: 'ignore',
        });
        for (let i = 0; i < 100; i++) {
          await pause(100);
          try {
            if ((await fetch(`${api}/health`)).ok) break;
          } catch {
            /* startup */
          }
        }
        const loginStarted = Date.now();
        const token = await login();
        const loginFinished = Date.now();
        const hash = createHash('sha256').update(token).digest('hex');
        const initial = (
          await observer.query(
            'SELECT id,extract(epoch from expires_at)::float8*1000 expiry_epoch,extract(epoch from expires_at-issued_at)::float8 ttl FROM sessions WHERE token_hash=$1',
            [hash],
          )
        ).rows[0];
        expect(initial.expiry_epoch).toBeGreaterThanOrEqual(loginStarted + 12 * 3600 * 1000);
        expect(initial.expiry_epoch).toBeLessThanOrEqual(loginFinished + 12 * 3600 * 1000);
        const direct = createPrismaClient(uri('wetop_service'), 'pms_test');
        let tenantId: string | null = privateData.org;
        const tenant = createPrismaClient(uri('wetop_service'), 'pms_test', {
          of: () => tenantId,
          appConnectionString: uri('wetop_app'),
        });
        try {
          const settings = async (db: typeof direct) =>
            db.$queryRawUnsafe<{ zone: string; pid: number; role: string }[]>(
              "SELECT current_setting('TimeZone') zone, pg_backend_pid() pid, current_user role",
            );
          for (const db of [direct, tenant]) {
            const first = await settings(db);
            expect(first[0]!.zone).toBe('UTC');
            const connections = await Promise.all(
              [1, 2].map(() =>
                db.$transaction(async (tx) => {
                  const rows = await tx.$queryRawUnsafe<
                    { zone: string; pid: number; role: string }[]
                  >(
                    "SELECT current_setting('TimeZone') zone, pg_backend_pid() pid, current_user role",
                  );
                  await tx.$executeRawUnsafe('SELECT pg_sleep(0.15)');
                  expect(rows).toHaveLength(1);
                  return rows[0]!;
                }),
              ),
            );
            expect(new Set(connections.map((x) => x.pid)).size).toBe(2);
            for (const connection of connections) expect(connection.zone).toBe('UTC');
            expect(
              connections.every((x) => x.role === (db === direct ? 'wetop_service' : 'wetop_app')),
            ).toBe(true);
            await db.$transaction(async (tx) => {
              await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'Asia/Dubai'");
            });
            expect((await settings(db))[0]!.zone).toBe('UTC');
            await expect(
              db.$transaction(async (tx) => {
                await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'Asia/Dubai'");
                throw new Error('A26 intentional rollback');
              }),
            ).rejects.toThrow('A26 intentional rollback');
            expect((await settings(db))[0]!.zone).toBe('UTC');
            await db.$executeRawUnsafe('RESET timezone');
            expect((await settings(db))[0]!.zone).toBe('UTC');
            proof.push({
              zone,
              nodeZone,
              mode: db === direct ? 'direct' : 'tenant',
              first,
              connections,
            });
          }
          expect(await tenant.organization.count({ where: { id: privateData.org } })).toBe(1);
          tenantId = '00000000-0000-0000-0000-000000000001';
          expect(await tenant.organization.count({ where: { id: privateData.org } })).toBe(0);
          tenantId = privateData.org;
          for (const fixed of ['2026-01-15T12:34:56.789Z', '2026-07-15T12:34:56.789Z']) {
            await observer.query('UPDATE sessions SET expires_at=$1 WHERE id=$2', [
              new Date(fixed),
              initial.id,
            ]);
            const session = await direct.session.findUniqueOrThrow({ where: { id: initial.id } });
            expect(session.expiresAt.toISOString()).toBe(fixed);
            expect(session.revokedAt).toBeNull();
            await direct.session.update({
              where: { id: initial.id },
              data: { expiresAt: new Date(fixed) },
            });
            const raw = (
              await observer.query(
                'SELECT extract(epoch from expires_at)::float8*1000 epoch FROM sessions WHERE id=$1',
                [initial.id],
              )
            ).rows[0];
            expect(raw.epoch).toBe(Date.parse(fixed));
          }
          const dateRows = await direct.$queryRawUnsafe<{ date: string; stamp: Date }[]>(
            "SELECT DATE '2026-02-28'::text date, TIMESTAMPTZ '2026-01-15 12:34:56.789+00' stamp",
          );
          expect(dateRows[0]!.date).toBe('2026-02-28');
          expect(dateRows[0]!.stamp.toISOString()).toBe('2026-01-15T12:34:56.789Z');
          for (const [state, seconds, expected] of [
            ['active', 60, 200],
            ['expired', -60, 401],
          ] as const) {
            await observer.query(
              "UPDATE sessions SET expires_at=clock_timestamp()+$1*interval '1 second' WHERE id=$2",
              [seconds, initial.id],
            );
            const status = (await me(token)).status;
            expect(status).toBe(expected);
            proof.push({ zone, nodeZone, state, status });
          }
          const revokeToken = await login();
          expect((await me(revokeToken)).status).toBe(200);
          expect(
            (
              await fetch(`${api}/auth/logout`, {
                method: 'POST',
                headers: { authorization: `Bearer ${revokeToken}` },
              })
            ).ok,
          ).toBe(true);
          expect((await me(revokeToken)).status).toBe(401);
          expect((await me('a26-unknown-token')).status).toBe(401);
          expect((await me(`${token}damaged`)).status).toBe(401);
        } finally {
          await direct.$disconnect();
          await tenant.$disconnect();
        }
      }
    } finally {
      await observer.query(
        `ALTER DATABASE ${databaseIdentifier} SET timezone='America/Los_Angeles'`,
      );
      await observer.end();
      if (process.env.A26_EVIDENCE)
        writeFileSync(`${process.env.A26_EVIDENCE}/matrix.json`, JSON.stringify(proof, null, 2), {
          mode: 0o600,
        });
    }
  }, 120_000);
});
