import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { createPrismaClient } from '../../packages/database/src/index';

const parent = process.env.A28_WORK_DIR ?? process.env.A26_WORK_DIR;
const databaseHost = process.env.A28_PG_HOST ?? '127.0.0.1';
const databasePort = Number(process.env.A28_PG_PORT ?? '55601');
const migratorRole = process.env.A28_PG_MIGRATOR_ROLE ?? 'a24_migrator';
const databaseName = process.env.A28_PG_DATABASE ?? 'a26_auth';
const connection = (role: string) =>
  `postgresql://${role}@${databaseHost}:${databasePort}/${databaseName}`;
const api = (process.env.A28_API_URL ?? 'http://127.0.0.1:4427').replace(/\/$/, '');
describe.skipIf(!parent)('A26 real HTTP session expiry', () => {
  it('keeps an active absolute expiry valid with a non UTC database default', async () => {
    const data = JSON.parse(readFileSync(`${parent}/a26-private.json`, 'utf8')) as {
      email: string;
      password: string;
    };
    const observer = new pg.Client({
      host: databaseHost,
      port: databasePort,
      user: migratorRole,
      database: databaseName,
      options: '-c search_path=pms_test,public',
    });
    await observer.connect();
    const prisma = createPrismaClient(
      connection('wetop_service'),
      'pms_test',
    );
    try {
      const login = await fetch(`${api}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      expect(login.status).toBe(201);
      const { token } = (await login.json()) as { token: string };
      const expiry = new Date(Date.now() + 60_000);
      const row = (
        await observer.query(
          "UPDATE sessions SET expires_at=$1 WHERE token_hash=$2 RETURNING id, extract(epoch from expires_at)::float8 * 1000 AS epoch, current_setting('TimeZone') zone, pg_backend_pid() pid",
          [expiry, createHash('sha256').update(token).digest('hex')],
        )
      ).rows[0];
      const session = await prisma.session.findUniqueOrThrow({ where: { id: row.id } });
      const response = await fetch(`${api}/auth/me`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const proof = {
        raw: row,
        expectedEpoch: expiry.getTime(),
        adapterEpoch: session.expiresAt.getTime(),
        httpStatus: response.status,
        expectedStatus: 200,
      };
      if (process.env.A26_EVIDENCE)
        writeFileSync(
          `${process.env.A26_EVIDENCE}/${process.env.A26_PHASE ?? 'auth'}.json`,
          JSON.stringify(proof, null, 2),
          { mode: 0o600 },
        );
      expect(row.epoch).toBe(expiry.getTime());
      expect(response.status).toBe(200);
      expect(session.expiresAt.getTime()).toBe(expiry.getTime());
    } finally {
      await prisma.$disconnect();
      await observer.end();
    }
  });
});
