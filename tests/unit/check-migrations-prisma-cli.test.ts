import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * CLI Prisma для сверки schema.prisma с миграциями (scripts/ops/check-migrations.sh, drift). npm кладёт его то в
 * packages/database/node_modules, то в общий node_modules (поднятие зависимостей после `npm audit fix` 22.10.2026),
 * и проверка падала «нет CLI Prisma» при установленном CLI. Скрипт обязан найти CLI там, где его положил npm.
 */
const ROOT = resolve(import.meta.dirname, '../..');
const script = readFileSync(resolve(ROOT, 'scripts/ops/check-migrations.sh'), 'utf8');

describe('check-migrations находит CLI Prisma', () => {
  it('смотрит и в пакете базы, и в общем node_modules', () => {
    expect(script).toContain('packages/database/node_modules/.bin/prisma');
    expect(script).toMatch(/\$ROOT\/node_modules\/\.bin\/prisma/);
  });
  it('в текущей установке хотя бы один из путей есть', () => {
    const found = ['packages/database/node_modules/.bin/prisma', 'node_modules/.bin/prisma'].some((p) =>
      existsSync(resolve(ROOT, p)),
    );
    expect(found).toBe(true);
  });
});
