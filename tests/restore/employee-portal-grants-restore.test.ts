import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Opt-in destructive restore rehearsal: disposable databases on a dedicated loopback cluster only.
// Never use DATABASE_URL (which can point at the shared development or production server).
const url = process.env['EMPLOYEE_PORTAL_RESTORE_TEST_URL'];
if (!url) throw new Error('Explicit disposable restore database URL required');
const ownerTarget = new URL(url);
const ownedCluster = ownerTarget.port === '55624';
const dedicatedJob = process.env.CI === 'true' && process.env.GITHUB_ACTIONS === 'true' && ownerTarget.port === '5432' && ['/postgres', '/pms_dev'].includes(ownerTarget.pathname);
if (process.env.NODE_ENV === 'production' || ownerTarget.protocol !== 'postgresql:' ||
  !['127.0.0.1', 'localhost'].includes(ownerTarget.hostname) || ownerTarget.search || ownerTarget.hash ||
  (!ownedCluster && !dedicatedJob)) throw new Error('Restore rehearsal requires its own cluster or isolated GitHub DB');
const migrations = resolve('packages/database/prisma/migrations');
const grants = join(migrations, '20261016000129_employee_portal_grants');
const tables =
  "'employee_public_profiles','employee_media','employee_portfolio_items','beauty_payroll_policies'";
const snapshot = `
SELECT 'ACL-T|' || c.relname || '|' || a::text
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace,
LATERAL unnest(coalesce(c.relacl,acldefault('r',c.relowner))) a
WHERE n.nspname='public' AND c.relname IN (${tables})
UNION ALL
SELECT 'ACL-F|' || p.proname || '|' || a::text
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace,
LATERAL unnest(coalesce(p.proacl,acldefault('f',p.proowner))) a
WHERE n.nspname='public' AND p.proname IN ('resolve_public_employee','employee_portfolio_scope_guard')
UNION ALL
SELECT 'RLS|' || c.relname || '|' || c.relrowsecurity || '|' || c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN (${tables})
UNION ALL
SELECT 'POLICY|' || tablename || '|' || policyname || '|' || roles::text || '|' || cmd || '|' || qual || '|' || with_check
FROM pg_policies WHERE schemaname='public' AND tablename IN (${tables})
ORDER BY 1`;

function run(command: string, args: string[], env = process.env) {
  const r = spawnSync(command, args, { encoding: 'utf8', timeout: 120_000, env });
  if (r.status !== 0)
    throw new Error(`${command}: ${r.error?.message ?? ''}\n${r.stderr}\n${r.stdout}`);
  return r.stdout.trim();
}

describe('employee portal permissions through the stock restore mechanism', () => {
  for (const optionalRoles of [false, true]) {
    it(`restores the exact migration-128 ACL and RLS (optional roles ${optionalRoles ? 'present' : 'absent'})`, () => {
      const connection = new URL(url!);
      expect(['127.0.0.1', 'localhost', '[::1]']).toContain(connection.hostname);
      const admin = new URL('/postgres', connection).toString();
      const name = `portal_restore_${randomBytes(6).toString('hex')}`;
      const source = new URL(`/${name}_source`, connection).toString();
      const target = new URL(`/${name}_target`, connection).toString();
      const dir = mkdtempSync(join(tmpdir(), 'employee-portal-restore-'));
      const sql = (db: string, text: string) =>
        run('psql', [db, '-XqAt', '-v', 'ON_ERROR_STOP=1', '-c', text]);
      const file = (db: string, path: string) =>
        run('psql', [db, '-XqAt', '-v', 'ON_ERROR_STOP=1', '-f', path]);
      const createdRoles: string[] = [];
      try {
        // Role creation is limited to this explicitly opted-in, otherwise role-free local cluster.
        expect(
          sql(admin, "SELECT count(*) FROM pg_roles WHERE rolname IN ('anon','authenticated')"),
        ).toBe('0');
        if (optionalRoles) {
          for (const role of ['anon', 'authenticated']) {
            sql(admin, `CREATE ROLE ${role} NOLOGIN`);
            createdRoles.push(role);
          }
        }
        sql(admin, `CREATE DATABASE ${name}_source`);
        sql(admin, `CREATE DATABASE ${name}_target`);
        sql(source, 'CREATE EXTENSION IF NOT EXISTS btree_gist');
        // Establish the contract from 128, not from the new replay migration.
        for (const migration of readdirSync(migrations)
          .sort()
          .filter((n) => n <= '20261016000128_employee_portal'))
          file(source, join(migrations, migration, 'migration.sql'));
        sql(
          source,
          'CREATE TABLE restore_portal_probe(id int PRIMARY KEY); INSERT INTO restore_portal_probe VALUES (1)',
        );
        const before = sql(source, snapshot);
        expect(before).toContain('ACL-F|resolve_public_employee|wetop_app=X/');
        expect(before).not.toMatch(
          /ACL-F\|(?:resolve_public_employee|employee_portfolio_scope_guard)\|=X/,
        );
        const dump = join(dir, 'portal.dump');
        run('pg_dump', [
          source,
          '--format=custom',
          '--no-owner',
          '--no-privileges',
          '--file',
          dump,
        ]);
        // Historical backups require matching migration files (docs/ops/backups.md:245).
        // The wrong current directory must fail closed and preserve the complete target state.
        sql(target, 'CREATE TABLE restore_target_probe(id int PRIMARY KEY); INSERT INTO restore_target_probe VALUES (17)');
        const targetBefore = sql(target, snapshot);
        const mismatched = spawnSync('bash',
          [resolve('scripts/ops/db-restore-prod.sh'), dump, '--yes-replace-production'],
          { encoding: 'utf8', timeout: 120_000, env: {
            ...process.env, ENV_FILE: join(dir, 'no.env'), RESTORE_DATABASE_URL: target,
            RESTORE_MIGRATIONS_DIR: migrations,
          } },
        );
        expect(mismatched.status).toBe(1);
        expect(mismatched.stderr).toMatch(/relation "customer_imports" does not exist/);
        expect(mismatched.stderr).toContain('откатилось целиком');
        expect(sql(target, 'SELECT id FROM restore_target_probe')).toBe('17');
        expect(sql(target, snapshot)).toBe(targetBefore);
        expect(sql(target, "SELECT to_regclass('public.employee_public_profiles') IS NULL")).toBe('t');
        // 129 repeats the ACL from 128 without requiring any later schema objects.
        const historicalMigrations = join(dir, 'migrations-through-129');
        mkdirSync(historicalMigrations);
        for (const migration of readdirSync(migrations).sort()
          .filter((name) => name <= '20261016000129_employee_portal_grants'))
          cpSync(join(migrations, migration), join(historicalMigrations, migration), { recursive: true });
        const output = run(
          'bash',
          [resolve('scripts/ops/db-restore-prod.sh'), dump, '--yes-replace-production'],
          {
            ...process.env,
            ENV_FILE: join(dir, 'no.env'),
            RESTORE_DATABASE_URL: target,
            RESTORE_MIGRATIONS_DIR: historicalMigrations,
          },
        );
        expect(sql(target, snapshot)).toBe(before);
        expect(output).toMatch(/права повторены миграциями: .*129/);
        expect(sql(target, 'SELECT id FROM restore_portal_probe')).toBe('1');
        // Replay must also repair explicit optional-role grants, not just PUBLIC defaults.
        if (optionalRoles) {
          sql(
            target,
            `GRANT ALL ON employee_public_profiles,employee_media,employee_portfolio_items,beauty_payroll_policies TO anon,authenticated;
            GRANT ALL ON FUNCTION resolve_public_employee(text) TO anon,authenticated`,
          );
        }
        // Replay is safe twice and rollback preserves the ACL already established by 128.
        file(target, join(grants, 'migration.sql'));
        file(target, join(grants, 'migration.sql'));
        expect(sql(target, snapshot)).toBe(before);
        file(target, join(grants, 'down.sql'));
        expect(sql(target, snapshot)).toBe(before);
        expect(
          sql(admin, "SELECT count(*) FROM pg_roles WHERE rolname IN ('anon','authenticated')"),
        ).toBe(optionalRoles ? '2' : '0');
      } finally {
        sql(admin, `DROP DATABASE IF EXISTS ${name}_target WITH (FORCE)`);
        sql(admin, `DROP DATABASE IF EXISTS ${name}_source WITH (FORCE)`);
        for (const role of createdRoles) sql(admin, `DROP ROLE ${role}`);
        rmSync(dir, { recursive: true, force: true });
      }
    }, 240_000);
  }
});
