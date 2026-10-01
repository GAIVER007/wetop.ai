import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * AGENTS.md §14: у каждой миграции есть откат. 22.09.2026 три миграции от 20.09 (подтверждение почты,
 * объект → организация, снятие `login_codes`) ушли в `main` без `down.sql`, а CI-задание `db`, которое это
 * ловит (`scripts/ops/check-migrations.sh`), с 20.09 не запускается — бюджет Actions. Этот сторож идёт в
 * `unit` и базы не требует; сам откат (схема снимок в снимок) по-прежнему доказывает скрипт.
 */
const MIGRATIONS = resolve(import.meta.dirname, '../../packages/database/prisma/migrations');
/** Отложенные миграции (docs/ops/migrations-held.md): лежат рядом, `migrate deploy` их не видит, откат нужен так же */
const HELD = resolve(import.meta.dirname, '../../packages/database/prisma/migrations-held');

const listDirs = (root: string): string[] =>
  existsSync(root)
    ? readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
    : [];

describe('миграции: у каждой есть откат (AGENTS.md §14)', () => {
  const dirs = listDirs(MIGRATIONS);

  it('папка миграций не пуста', () => {
    expect(dirs.length).toBeGreaterThan(0);
  });

  it.each(dirs)('%s — есть migration.sql и down.sql', (name) => {
    expect(existsSync(resolve(MIGRATIONS, name, 'migration.sql')), 'migration.sql').toBe(true);
    expect(existsSync(resolve(MIGRATIONS, name, 'down.sql')), 'down.sql').toBe(true);
  });
});

/**
 * Отложенные миграции (разбор 01.10.2026, reports/order-2026-10-01, пункт 4): миграция, которую применяют только после
 * выкладки кода (039: профиль продавца по агенту), не лежит в общей цепочке, иначе `migrate deploy` применит её раньше
 * кода. Папка `migrations-held` держит её до своего релиза; имя не должно повторять имя из цепочки, откат нужен так же,
 * а ворота `check-migrations.sh` и сборка схемы автотестов (`tests/tools/test-schema.ts`) обязаны про папку знать:
 * `schema.prisma` описывает базу вместе с отложенными.
 */
describe('отложенные миграции: migrations-held', () => {
  const held = listDirs(HELD);
  const chain = new Set(listDirs(MIGRATIONS));

  it.each(held)('%s: есть migration.sql и down.sql, в цепочке такого имени нет', (name) => {
    expect(existsSync(resolve(HELD, name, 'migration.sql')), 'migration.sql').toBe(true);
    expect(existsSync(resolve(HELD, name, 'down.sql')), 'down.sql').toBe(true);
    expect(chain.has(name), 'имя занято в цепочке').toBe(false);
  });

  it('039 (профиль продавца по агенту) отложена, пока её релиз не пришёл', () => {
    expect(held).toContain('20260930000039_seller_profile_agent_key');
    expect(chain.has('20260930000039_seller_profile_agent_key')).toBe(false);
  });

  it('ворота миграций сверяют schema.prisma с цепочкой вместе с отложенными', () => {
    const script = readFileSync(resolve(import.meta.dirname, '../../scripts/ops/check-migrations.sh'), 'utf8');
    expect(script).toContain('migrations-held');
  });

  it('схема автотестов строится из цепочки вместе с отложенными', () => {
    const builder = readFileSync(resolve(import.meta.dirname, '../../tests/tools/test-schema.ts'), 'utf8');
    expect(builder).toContain('migrations-held');
  });
});

/**
 * Ворота `check-migrations.sh` на macOS (26.09.2026): системный bash там 3.2 и не знает `mapfile`. Список миграций
 * выходил пустым, а итог — «RESULT: OK» без единой проверенной миграции: ложный зелёный. Скрипт пишется под bash 3.2,
 * а пустой список — отказ, а не успех.
 */
describe('ворота миграций работают и на bash 3.2', () => {
  const script = readFileSync(resolve(import.meta.dirname, '../../scripts/ops/check-migrations.sh'), 'utf8');
  it('без mapfile и readarray (их нет в bash 3.2)', () => {
    const code = script.split('\n').filter((line) => !line.trimStart().startsWith('#'));
    expect(code.join('\n')).not.toMatch(/\b(mapfile|readarray)\b/);
  });
  it('пустой список миграций — отказ, а не RESULT: OK', () => {
    expect(script).toMatch(/if \[ "\$\{#MIGS\[@\]\}" -eq 0 \]/);
  });
});
