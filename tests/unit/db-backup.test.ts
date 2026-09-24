import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * scripts/ops/db-backup.sh — ночная копия рабочей базы (Q-073, остаток проверки SECURITY.md 24.09.2026, О1).
 *
 * Организация Supabase на бесплатном плане, а ежедневные бэкапы Supabase делает только с плана Pro: рабочая база с
 * бронями с 19.09 не копировалась вовсе. Скрипт снимает `pg_dump -Fc` схемы public, проверяет копию
 * `pg_restore --list`, кладёт её с правами 600 и удаляет копии старше срока. Здесь `pg_dump` и `pg_restore` —
 * заглушки, настоящий только скрипт; живой прогон на локальной PostgreSQL описан в docs/ops/backups.md.
 */
const SCRIPT = resolve('scripts/ops/db-backup.sh');
const PASSWORD = 's3cr3t-pass';
const DIRECT = `postgresql://owner:${PASSWORD}@db.example.invalid:5432/postgres`;
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function sandbox(opts: { pgVersion?: string; tables?: number; env?: string | null; dumpFails?: boolean } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'wetop-db-backup-'));
  dirs.push(dir);
  const bin = join(dir, 'bin');
  const backups = join(dir, 'backups');
  mkdirSync(bin);
  const executable = (name: string, body: string) =>
    writeFileSync(join(bin, name), `#!/bin/sh\nset -eu\n${body}\n`, { mode: 0o755 });
  executable(
    'pg_dump',
    [
      `if [ "\${1:-}" = "--version" ]; then echo "pg_dump (PostgreSQL) ${opts.pgVersion ?? '17.6'}"; exit 0; fi`,
      'printf "%s\\n" "$@" > "$AUDIT_DIR/pg_dump-args"',
      opts.dumpFails
        ? // как настоящий pg_dump при отказе базы: сообщение, в котором бывает адрес
          `echo "pg_dump: error: connection to ${DIRECT} failed" >&2; exit 1`
        : 'for a in "$@"; do case "$a" in --file=*) printf "PGDMP" > "${a#--file=}";; esac; done',
    ].join('\n'),
  );
  writeFileSync(
    join(dir, 'list'),
    Array.from({ length: opts.tables ?? 3 }, (_, i) => `${i + 10}; 0 16400 TABLE DATA public t${i} postgres\n`).join(''),
  );
  executable('pg_restore', '[ "${1:-}" = "--list" ] && cat "$AUDIT_DIR/list"\nexit 0');
  if (opts.env !== null)
    writeFileSync(
      join(dir, '.env'),
      opts.env ?? `DATABASE_URL=postgresql://pooler.example.invalid:6543/postgres\nDIRECT_URL="${DIRECT}"\n`,
    );
  const run = (extra: Record<string, string> = {}) => {
    const inherited = { ...process.env };
    for (const k of ['DATABASE_URL', 'DIRECT_URL', 'BACKUP_DATABASE_URL', 'BACKUP_KEEP_DAYS']) delete inherited[k];
    return spawnSync('bash', [SCRIPT], {
      encoding: 'utf8',
      timeout: 10_000,
      env: {
        ...inherited,
        PATH: `${bin}:${process.env.PATH}`,
        ENV_FILE: join(dir, '.env'),
        BACKUP_DIR: backups,
        AUDIT_DIR: dir,
        ...extra,
      },
    });
  };
  const dumps = () => (existsSync(backups) ? readdirSync(backups).sort() : []);
  const dumpArgs = () =>
    existsSync(join(dir, 'pg_dump-args')) ? readFileSync(join(dir, 'pg_dump-args'), 'utf8').trim().split('\n') : null;
  return { dir, backups, run, dumps, dumpArgs };
}

describe('db-backup.sh: ночная копия рабочей базы', { timeout: 30_000 }, () => {
  it('снимает копию схемы public по DIRECT_URL из .env, проверяет её и кладёт с правами 600; пароль не печатается', () => {
    const sb = sandbox();
    const r = sb.run();
    expect(r.status, r.stdout + r.stderr).toBe(0);

    const files = sb.dumps();
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^wetop-\d{8}T\d{6}Z\.dump$/);
    expect(statSync(join(sb.backups, files[0]!)).mode & 0o777).toBe(0o600);

    const args = sb.dumpArgs()!;
    expect(args).toEqual(
      expect.arrayContaining(['--format=custom', '--schema=public', '--no-owner', '--no-privileges', DIRECT]),
    );
    expect(r.stdout).toContain('таблиц с данными: 3');
    expect(r.stdout + r.stderr).not.toContain(PASSWORD);
  });

  it('адрес из BACKUP_DATABASE_URL важнее .env', () => {
    const sb = sandbox();
    const own = 'postgresql://reader@backup.example.invalid:5432/postgres';
    expect(sb.run({ BACKUP_DATABASE_URL: own }).status).toBe(0);
    expect(sb.dumpArgs()).toContain(own);
  });

  it('pg_dump старше базы — отказ до съёмки: 16 не снимет базу 17', () => {
    const sb = sandbox({ pgVersion: '16.13' });
    const r = sb.run();
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/17/);
    expect(sb.dumpArgs()).toBeNull();
    expect(sb.dumps()).toEqual([]);
  });

  it('без строки подключения — понятный отказ, pg_dump не зовётся', () => {
    const sb = sandbox({ env: null });
    const r = sb.run();
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/DIRECT_URL/);
    expect(sb.dumpArgs()).toBeNull();
  });

  it('копия без таблиц с данными не принимается и недописанной не остаётся', () => {
    const sb = sandbox({ tables: 0 });
    const r = sb.run();
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/нет ни одной таблицы/);
    expect(sb.dumps()).toEqual([]);
  });

  it('pg_dump упал — копии нет, код ненулевой, пароль из его сообщения замаскирован', () => {
    const sb = sandbox({ dumpFails: true });
    const r = sb.run();
    expect(r.status).not.toBe(0);
    expect(sb.dumps()).toEqual([]);
    expect(r.stderr).toContain('connection to');
    expect(r.stdout + r.stderr).not.toContain(PASSWORD);
  });

  it('копии старше срока удаляются, свежие и чужие файлы остаются', () => {
    const sb = sandbox();
    mkdirSync(sb.backups);
    const day = 24 * 3600 * 1000;
    const old = join(sb.backups, 'wetop-20260901T000000Z.dump');
    const fresh = join(sb.backups, 'wetop-20260922T000000Z.dump');
    const foreign = join(sb.backups, 'luxx-before-reset-2026-09-19.dump');
    for (const f of [old, fresh, foreign]) writeFileSync(f, 'PGDMP');
    const ago = (days: number) => new Date(Date.now() - days * day);
    utimesSync(old, ago(20), ago(20));
    utimesSync(fresh, ago(2), ago(2));
    utimesSync(foreign, ago(30), ago(30));

    const r = sb.run({ BACKUP_KEEP_DAYS: '14' });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    const files = sb.dumps();
    expect(files).not.toContain('wetop-20260901T000000Z.dump');
    expect(files).toContain('wetop-20260922T000000Z.dump');
    expect(files).toContain('luxx-before-reset-2026-09-19.dump');
    expect(files.filter((f) => /^wetop-.*\.dump$/.test(f))).toHaveLength(2);
    expect(r.stdout).toContain('wetop-20260901T000000Z.dump');
  });
});
