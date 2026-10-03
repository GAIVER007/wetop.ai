import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Миграции «отдельного релиза» лежат вне общей цепочки до своего релиза (ADR-137, замечание ментора 02.10.2026).
 *
 * 039 (`seller_profile_agent_key`, SA2.5 «сузить») помечена «🔴 ОТДЕЛЬНЫЙ РЕЛИЗ»: код до SA2.5 на схеме после неё
 * не работает. Но лежала она в `prisma/migrations/`, откуда `prisma migrate deploy` применил бы её вместе с соседними.
 * Теперь такая миграция ждёт в `prisma/migrations-hold/` и переезжает в `migrations/` коммитом своего релиза
 * (порядок: README той папки). Сторож: метка в общей цепочке допустима только у уже выпущенных.
 */
const PRISMA = resolve(import.meta.dirname, '../../packages/database/prisma');
const MIGRATIONS = resolve(PRISMA, 'migrations');
const HOLD = resolve(PRISMA, 'migrations-hold');
const MARK = 'ОТДЕЛЬНЫЙ РЕЛИЗ';

/** Выпущенные отдельным шагом: метка осталась в файле как история, применение подтверждено в рабочей базе */
const RELEASED_SEPARATELY: ReadonlyMap<string, string> = new Map([
  [
    '20260930000039_seller_profile_agent_key',
    'применена в рабочей базе 30.09.2026 отдельным шагом (список миграций Supabase)',
  ],
]);

const migrationDirs = (root: string): string[] =>
  existsSync(root)
    ? readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
    : [];

const marked = (root: string, name: string): boolean => {
  const sql = resolve(root, name, 'migration.sql');
  return existsSync(sql) && readFileSync(sql, 'utf8').includes(MARK);
};

describe('миграции отдельного релиза ждут вне общей цепочки (ADR-137)', () => {
  it('в migrations/ метка «ОТДЕЛЬНЫЙ РЕЛИЗ» только у выпущенных: новая такая миграция лежит в migrations-hold/', () => {
    const unreleased = migrationDirs(MIGRATIONS).filter(
      (name) => marked(MIGRATIONS, name) && !RELEASED_SEPARATELY.has(name),
    );
    expect(unreleased, 'перенести в packages/database/prisma/migrations-hold/ до релиза').toEqual([]);
  });

  it('список выпущенных не врёт: каждая из них есть в migrations/ и несёт метку', () => {
    for (const name of RELEASED_SEPARATELY.keys()) expect(marked(MIGRATIONS, name), name).toBe(true);
  });

  it('у ждущей миграции есть migration.sql с меткой и down.sql (AGENTS.md §14), и её нет в общей цепочке', () => {
    expect(existsSync(resolve(HOLD, 'README.md')), 'migrations-hold/README.md: порядок релиза').toBe(true);
    const chain = new Set(migrationDirs(MIGRATIONS));
    for (const name of migrationDirs(HOLD)) {
      expect(marked(HOLD, name), `${name}: migration.sql с меткой «${MARK}»`).toBe(true);
      expect(existsSync(resolve(HOLD, name, 'down.sql')), `${name}: down.sql`).toBe(true);
      expect(chain.has(name), `${name} лежит и в migrations/`).toBe(false);
    }
  });

  it('Prisma берёт миграции только из prisma/migrations: ждущие не применяются', () => {
    const config = readFileSync(resolve(PRISMA, '../prisma.config.ts'), 'utf8');
    expect(config).toMatch(/migrations:\s*\{\s*path:\s*'prisma\/migrations'\s*\}/);
  });
});
