import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * AGENTS.md §14: у каждой миграции есть откат. 22.09.2026 три миграции от 20.09 (подтверждение почты,
 * объект → организация, снятие `login_codes`) ушли в `main` без `down.sql`, а CI-задание `db`, которое это
 * ловит (`scripts/ops/check-migrations.sh`), с 20.09 не запускается — бюджет Actions. Этот сторож идёт в
 * `unit` и базы не требует; сам откат (схема снимок в снимок) по-прежнему доказывает скрипт.
 */
const MIGRATIONS = resolve(import.meta.dirname, '../../packages/database/prisma/migrations');

describe('миграции: у каждой есть откат (AGENTS.md §14)', () => {
  const dirs = readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  it('папка миграций не пуста', () => {
    expect(dirs.length).toBeGreaterThan(0);
  });

  it.each(dirs)('%s — есть migration.sql и down.sql', (name) => {
    expect(existsSync(resolve(MIGRATIONS, name, 'migration.sql')), 'migration.sql').toBe(true);
    expect(existsSync(resolve(MIGRATIONS, name, 'down.sql')), 'down.sql').toBe(true);
  });
});
