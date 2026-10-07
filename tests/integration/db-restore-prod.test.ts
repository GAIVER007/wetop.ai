import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Ступень 2 отката: рабочая база из ночной копии (scripts/ops/db-restore-prod.sh; CUTOVER.md, «Откат»; ADR-137).
 *
 * Проба 02.10.2026 на копии схемы: копия db-backup.sh снята без прав, а таблицы при восстановлении создаются заново
 * и получают права по умолчанию из миграции 026. Наивный pg_restore отдавал роли стойки wetop_app полный доступ
 * к users (хеши паролей), password_resets, channel_outbox и ещё семи таблицам: откат молча снимал SEC-1b. Тест держит
 * всю цепочку на своей базе со всеми миграциями: копия, порча, восстановление, и права роли стойки после него
 * совпадают с правами до порчи до последнего столбца, данные как в копии, RLS на месте.
 */
const url = process.env['DATABASE_URL'];
const pgMajor = (() => {
  const r = spawnSync('pg_dump', ['--version'], { encoding: 'utf8' });
  const m = /\(PostgreSQL\) (\d+)/.exec(r.stdout ?? '');
  const psql = spawnSync('psql', ['--version'], { encoding: 'utf8' });
  const restore = spawnSync('pg_restore', ['--version'], { encoding: 'utf8' });
  return m && psql.status === 0 && restore.status === 0 ? Number(m[1]) : null;
})();
const MIGRATIONS = resolve('packages/database/prisma/migrations');

/** Права ролей WETOP на всё в public: таблицы, столбцы, последовательности, функции; политики и RLS */
const PRIVILEGES_SQL = `
with roles(r) as (select rolname from pg_roles where rolname in ('wetop_app', 'wetop_service')),
rels as (select c.oid, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')),
cols as (select c.oid, c.relname, a.attname from pg_attribute a join pg_class c on c.oid = a.attrelid
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind in ('r', 'p') and a.attnum > 0 and not a.attisdropped),
seqs as (select c.oid, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'S')
select 'T|' || relname || '|' || r || '|' || p || '|' || has_table_privilege(r, oid, p)
  from rels, roles, (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) v(p)
union all select 'C|' || relname || '.' || attname || '|' || r || '|' || p || '|' || has_column_privilege(r, oid, attname, p)
  from cols, roles, (values ('SELECT'), ('INSERT'), ('UPDATE')) v(p)
union all select 'S|' || relname || '|' || r || '|' || has_sequence_privilege(r, oid, 'USAGE')
  from seqs, roles
union all select 'P|' || tablename || ':' || policyname || '|' || array_to_string(roles, ',') || '|' || cmd
  from pg_policies where schemaname = 'public'
union all select 'R|' || c.relname || '|' || c.relrowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'
order by 1`;

describe.skipIf(!url || pgMajor === null)('db-restore-prod.sh на настоящей PostgreSQL: данные из копии, права как были', () => {
  const db = `wetop_restore_it_${randomBytes(4).toString('hex')}`;
  let admin = '';
  let target = '';
  let dir = '';
  const psql = (sql: string, file?: string) => {
    const args = [target, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'];
    const r = spawnSync('psql', file ? [...args, '-f', file] : [...args, '-c', sql], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr);
    return r.stdout.trim();
  };

  beforeAll(() => {
    const base = url!.replace(/\?.*$/, '');
    admin = base.replace(/\/[^/]*$/, '/postgres');
    target = base.replace(/\/[^/]*$/, `/${db}`);
    dir = mkdtempSync(join(tmpdir(), 'wetop-restore-it-'));
    const created = spawnSync('psql', [admin, '-qv', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE ${db}`], {
      encoding: 'utf8',
    });
    if (created.status !== 0) throw new Error(created.stderr);
    psql('CREATE EXTENSION IF NOT EXISTS btree_gist');
    // вся цепочка миграций, как в рабочей базе: роли, RLS, права SEC-1b
    for (const name of readdirSync(MIGRATIONS).sort()) psql('', join(MIGRATIONS, name, 'migration.sql'));
    psql("CREATE TABLE public.restore_probe (id int PRIMARY KEY, note text); INSERT INTO public.restore_probe VALUES (1, 'до копии'), (2, 'до копии')");
  }, 120_000);
  afterAll(() => {
    if (admin) spawnSync('psql', [admin, '-qc', `DROP DATABASE IF EXISTS ${db}`]);
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('после копии и порчи: данные как в копии, RLS включён, права wetop_app совпадают с прежними', () => {
    const before = psql(PRIVILEGES_SQL);
    // проверка самой проверки: до порчи роль стойки не читает хеши паролей (SEC-1b)
    expect(before).toContain('C|users.password_hash|wetop_app|SELECT|false');

    const backup = spawnSync('bash', [resolve('scripts/ops/db-backup.sh')], {
      encoding: 'utf8',
      timeout: 60_000,
      env: { ...process.env, BACKUP_DATABASE_URL: target, BACKUP_DIR: dir, BACKUP_MIN_PG: String(pgMajor) },
    });
    expect(backup.status, backup.stdout + backup.stderr).toBe(0);
    const [dump] = readdirSync(dir).filter((f) => /^wetop-.*\.dump$/.test(f));
    expect(dump).toBeDefined();

    // порча после копии: запись, удаление и снятый RLS
    psql("DELETE FROM public.restore_probe WHERE id = 2; INSERT INTO public.restore_probe VALUES (3, 'после копии')");
    psql('ALTER TABLE public.reservations DISABLE ROW LEVEL SECURITY');

    const refused = spawnSync('bash', [resolve('scripts/ops/db-restore-prod.sh'), join(dir, dump!)], {
      encoding: 'utf8',
      env: { ...process.env, RESTORE_DATABASE_URL: target },
    });
    expect(refused.status, 'без подтверждения не восстанавливает').toBe(2);
    expect(psql('SELECT count(*) FROM public.restore_probe')).toBe('2');

    const restore = spawnSync(
      'bash',
      [resolve('scripts/ops/db-restore-prod.sh'), join(dir, dump!), '--yes-replace-production'],
      { encoding: 'utf8', timeout: 120_000, env: { ...process.env, RESTORE_DATABASE_URL: target } },
    );
    expect(restore.status, restore.stdout + restore.stderr).toBe(0);
    expect(restore.stdout).toContain('права повторены миграциями: 026 033');

    expect(psql("SELECT string_agg(id || ':' || note, ', ' ORDER BY id) FROM public.restore_probe")).toBe(
      '1:до копии, 2:до копии',
    );
    expect(psql("SELECT relrowsecurity FROM pg_class WHERE oid = 'public.reservations'::regclass")).toBe('t');
    const after = psql(PRIVILEGES_SQL);
    const diff = before
      .split('\n')
      .filter((line) => !after.includes(line))
      .slice(0, 10);
    expect(diff, 'права до порчи, которых нет после восстановления').toEqual([]);
    expect(after).toBe(before);
  }, 240_000);

  it('сбой посреди восстановления откатывает всё: база остаётся как была', () => {
    const [dump] = readdirSync(dir).filter((f) => /^wetop-.*\.dump$/.test(f));
    psql("INSERT INTO public.restore_probe VALUES (4, 'после копии, до сбоя')");
    const broken = mkdtempSync(join(tmpdir(), 'wetop-restore-broken-'));
    try {
      // папка миграций, где последняя миграция прав ссылается на несуществующую таблицу
      const name = readdirSync(MIGRATIONS)
        .sort()
        .filter((n) => {
          const body = readFileSync(join(MIGRATIONS, n, 'migration.sql'), 'utf8').replace(/^\s*--.*$/gm, '');
          return /\b(GRANT|REVOKE)\b/.test(body) && !/^(CREATE|ALTER|DROP|TRUNCATE|INSERT|UPDATE|DELETE)\s/m.test(body);
        })
        .pop()!;
      spawnSync('cp', ['-R', MIGRATIONS, join(broken, 'migrations')]);
      spawnSync('sh', [
        '-c',
        `printf '\\nGRANT SELECT ON TABLE public.no_such_table TO wetop_app;\\n' >> "${join(broken, 'migrations', name, 'migration.sql')}"`,
      ]);
      const r = spawnSync(
        'bash',
        [resolve('scripts/ops/db-restore-prod.sh'), join(dir, dump!), '--yes-replace-production'],
        {
          encoding: 'utf8',
          timeout: 120_000,
          env: {
            ...process.env,
            RESTORE_DATABASE_URL: target,
            RESTORE_MIGRATIONS_DIR: join(broken, 'migrations'),
          },
        },
      );
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('откатилось целиком');
      expect(psql('SELECT count(*) FROM public.restore_probe WHERE id = 4')).toBe('1');
    } finally {
      rmSync(broken, { recursive: true, force: true });
    }
  }, 240_000);
});
