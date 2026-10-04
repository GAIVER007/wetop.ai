import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * scripts/ops/db-restore-prod.sh, ступень 2 отката (CUTOVER.md, «Откат»; ADR-137). Здесь pg_restore и psql подменены:
 * держится то, что видно без базы. Подтверждение обязательно; пароль не в аргументах; схема public из копии не
 * пересоздаётся; после данных в той же транзакции идут ВСЕ миграции прав по порядку, иначе роль стойки получила бы
 * полный доступ к хешам паролей. Настоящая PostgreSQL: tests/integration/db-restore-prod.test.ts.
 */
const SCRIPT = resolve('scripts/ops/db-restore-prod.sh');
const MIGRATIONS = resolve('packages/database/prisma/migrations');
const PASSWORD = 'pa55-word';
const URL = `postgresql://postgres.ref:${PASSWORD}@db.example.invalid:5432/postgres`;
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** Миграции прав, как их понимает скрипт: GRANT или REVOKE словом вне строк-комментариев */
const privilegeMigrations = readdirSync(MIGRATIONS)
  .sort()
  .filter((name) =>
    readFileSync(join(MIGRATIONS, name, 'migration.sql'), 'utf8')
      .split('\n')
      .filter((line) => !/^\s*--/.test(line))
      .some((line) => /\b(GRANT|REVOKE)\b/.test(line)),
  );

function sandbox(opts: { check?: string; psqlFails?: boolean } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'wetop-restore-'));
  dirs.push(dir);
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  const stub = (name: string, body: string) =>
    writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  stub(
    'pg_restore',
    [
      'echo "pg_restore $*" >> "$AUDIT/calls"',
      'case "$*" in',
      '  *--list*) printf "%s\\n" "4; 2615 2200 SCHEMA - public pg_database_owner" "5; 0 0 COMMENT - SCHEMA public pg_database_owner" "3001; 0 16390 TABLE DATA public reservations postgres" "3002; 0 16400 TABLE DATA public users postgres" ;;',
      '  *) cp "$(echo "$*" | sed -E "s/.*--use-list=([^ ]+).*/\\1/")" "$AUDIT/used-list"; echo "-- данные копии"; echo "SELECT pg_catalog.set_config(\'search_path\', \'\', false);" ;;',
      'esac',
    ].join('\n'),
  );
  stub(
    'psql',
    [
      'echo "psql $*" >> "$AUDIT/calls"',
      'printf "%s" "${PGPASSWORD:-}" > "$AUDIT/pgpassword"',
      'for a in "$@"; do case "$a" in *.sql) cp "$a" "$AUDIT/restore.sql" ;; esac; done',
      opts.psqlFails ? 'case "$*" in *single-transaction*) echo "ERROR: boom" >&2; exit 3 ;; esac' : ':',
      `case "$*" in *has_table_privilege*) echo "${opts.check ?? 'закрыто'}" ;; esac`,
      'exit 0',
    ].join('\n'),
  );
  const dump = join(dir, 'wetop-20261002T233000Z.dump');
  writeFileSync(dump, 'PGDMP');
  const run = (args: string[]) => {
    const inherited = { ...process.env };
    for (const k of ['DATABASE_URL', 'DIRECT_URL', 'BACKUP_DATABASE_URL', 'RESTORE_DATABASE_URL', 'PGPASSWORD'])
      delete inherited[k];
    const r = spawnSync('bash', [SCRIPT, ...args], {
      encoding: 'utf8',
      timeout: 15_000,
      env: {
        ...inherited,
        PATH: `${bin}:${process.env.PATH}`,
        AUDIT: dir,
        ENV_FILE: join(dir, 'no.env'),
        RESTORE_DATABASE_URL: `${URL}?pgbouncer=true&sslmode=require`,
      },
    });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  };
  const read = (name: string) => (existsSync(join(dir, name)) ? readFileSync(join(dir, name), 'utf8') : '');
  return { run, dump, read };
}

describe('восстановление рабочей базы из копии (ADR-137)', () => {
  it('без --yes-replace-production ничего не делает', () => {
    const s = sandbox();
    const r = s.run([s.dump]);
    expect(r.code).toBe(2);
    expect(r.out).toContain('--yes-replace-production');
    expect(s.read('calls')).toBe('');
  });

  it('данные и все миграции прав одной транзакцией, права после данных и по порядку', () => {
    expect(privilegeMigrations.length, 'миграции прав в репозитории').toBeGreaterThan(0);
    const s = sandbox();
    const r = s.run([s.dump, '--yes-replace-production']);
    expect(r.code, r.out).toBe(0);
    expect(s.read('calls')).toMatch(/psql .*--single-transaction/);
    expect(s.read('calls')).toMatch(/pg_restore .*--clean --if-exists --no-owner --no-privileges/);
    const sql = s.read('restore.sql');
    const at = (needle: string) => sql.indexOf(needle);
    expect(at('-- данные копии')).toBeGreaterThan(-1);
    // pg_restore обнуляет search_path, миграции прав берут схему из current_schema()
    expect(at('SET search_path TO public;')).toBeGreaterThan(at('-- данные копии'));
    let previous = at('SET search_path TO public;');
    for (const name of privilegeMigrations) {
      const position = at(`-- права: ${name}`);
      expect(position, name).toBeGreaterThan(previous);
      previous = position;
    }
    expect(r.out).toContain(`права повторены миграциями: ${privilegeMigrations.map((n) => n.split('_')[0]!.slice(-3)).join(' ')}`);
  });

  it('схема public из копии не пересоздаётся: её записи вычеркнуты из оглавления', () => {
    const s = sandbox();
    expect(s.run([s.dump, '--yes-replace-production']).code).toBe(0);
    const used = s.read('used-list');
    expect(used).toContain('TABLE DATA public reservations');
    expect(used).not.toContain('SCHEMA - public');
    expect(used).not.toContain('COMMENT - SCHEMA public');
  });

  it('пароль идёт в PGPASSWORD, не в аргументы; параметры Prisma срезаны', () => {
    const s = sandbox();
    expect(s.run([s.dump, '--yes-replace-production']).code).toBe(0);
    expect(s.read('calls')).not.toContain(PASSWORD);
    expect(s.read('calls')).not.toContain('pgbouncer');
    expect(s.read('calls')).toContain('sslmode=require');
    expect(s.read('pgpassword')).toBe(PASSWORD);
  });

  it('транзакция упала: код 1 и прямое «откатилось целиком», пароль в сообщении скрыт', () => {
    const s = sandbox({ psqlFails: true });
    const r = s.run([s.dump, '--yes-replace-production']);
    expect(r.code).toBe(1);
    expect(r.out).toContain('откатилось целиком');
    expect(r.out).not.toContain(PASSWORD);
  });

  it('после восстановления wetop_app читает users целиком: отказ, API не запускать', () => {
    const s = sandbox({ check: 'открыто' });
    const r = s.run([s.dump, '--yes-replace-production']);
    expect(r.code).toBe(1);
    expect(r.out).toContain('API не запускать');
  });
});
