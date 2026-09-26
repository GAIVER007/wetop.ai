import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseBackupStatus } from '../../packages/domain/src/incidents/signals';

/**
 * Копия рабочей базы и её пробное восстановление на настоящей PostgreSQL (Q-073, остаток проверки SECURITY.md, О1).
 *
 * 24.09.2026 первая же проба показала: копия одной схемы public в новую базу наивным pg_restore не встаёт — она
 * начинается с CREATE SCHEMA public, а схема в новой базе уже есть. Тест держит всю цепочку на своей базе (не на
 * данных других тестов): db-backup.sh снимает копию, db-restore-check.sh разворачивает её в новую базу и сверяет.
 * Таблица с исключающим ограничением на btree_gist — как у броней: без расширения копия бы не встала.
 */
const url = process.env['DATABASE_URL'];
const pgMajor = (() => {
  const r = spawnSync('pg_dump', ['--version'], { encoding: 'utf8' });
  const m = /\(PostgreSQL\) (\d+)/.exec(r.stdout ?? '');
  const psql = spawnSync('psql', ['--version'], { encoding: 'utf8' });
  return m && psql.status === 0 ? Number(m[1]) : null;
})();

describe.skipIf(!url || pgMajor === null)('db-backup.sh и db-restore-check.sh на настоящей PostgreSQL', () => {
  const db = `wetop_backup_it_${randomBytes(4).toString('hex')}`;
  let admin = '';
  let source = '';
  let dir = '';
  const psql = (target: string, sql: string) => {
    const r = spawnSync('psql', [target, '-qv', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr);
  };

  beforeAll(() => {
    const base = url!.replace(/\?.*$/, '');
    admin = base.replace(/\/[^/]*$/, '/postgres');
    source = base.replace(/\/[^/]*$/, `/${db}`);
    dir = mkdtempSync(join(tmpdir(), 'wetop-backup-it-'));
    psql(admin, `CREATE DATABASE ${db}`);
    psql(
      source,
      [
        'CREATE EXTENSION IF NOT EXISTS btree_gist',
        'CREATE TABLE public.stays (unit int NOT NULL, during daterange NOT NULL, ' +
          'EXCLUDE USING gist (unit WITH =, during WITH &&))',
        "INSERT INTO public.stays VALUES (1, '[2026-10-01,2026-10-03)'), (1, '[2026-10-03,2026-10-05)'), (2, '[2026-10-01,2026-10-02)')",
        'CREATE TABLE public.empty_one (id int PRIMARY KEY)',
      ].join('; '),
    );
  });
  afterAll(() => {
    if (admin) spawnSync('psql', [admin, '-qc', `DROP DATABASE IF EXISTS ${db}`]);
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('копия снимается и встаёт в новую базу: обе таблицы, все строки, ограничение на btree_gist', () => {
    const backup = spawnSync('bash', [resolve('scripts/ops/db-backup.sh')], {
      encoding: 'utf8',
      timeout: 60_000,
      env: { ...process.env, BACKUP_DATABASE_URL: source, BACKUP_DIR: dir, BACKUP_MIN_PG: String(pgMajor) },
    });
    expect(backup.status, backup.stdout + backup.stderr).toBe(0);
    expect(backup.stdout).toContain('таблиц с данными: 2');
    const [dump] = readdirSync(dir).filter((f) => /^wetop-.*\.dump$/.test(f));
    expect(dump).toBeDefined();
    // статус для сторожа стойки (ADR-078) после настоящего pg_dump читается тем же разбором, что у сторожа
    const status = parseBackupStatus(readFileSync(join(dir, 'status', 'last.json'), 'utf8'));
    expect(status).toMatchObject({ file: dump, tables: 2 });

    const check = spawnSync('bash', [resolve('scripts/ops/db-restore-check.sh'), join(dir, dump!)], {
      encoding: 'utf8',
      timeout: 60_000,
      env: { ...process.env, RESTORE_CHECK_URL: admin },
    });
    expect(check.status, check.stdout + check.stderr).toBe(0);
    expect(check.stdout).toContain('таблиц 2 из 2, строк 3');
  }, 120_000);

  it('проба отказывает серверу не на этой машине — рабочую базу она не трогает', () => {
    const check = spawnSync(
      'bash',
      [resolve('scripts/ops/db-restore-check.sh'), resolve('package.json')],
      {
        encoding: 'utf8',
        timeout: 30_000,
        env: { ...process.env, RESTORE_CHECK_URL: 'postgresql://postgres:secret@db.example.invalid:5432/postgres' },
      },
    );
    expect(check.status).toBe(2);
    expect(check.stderr).toContain('не на этой машине');
    expect(check.stderr).not.toContain('secret');
  });
});
