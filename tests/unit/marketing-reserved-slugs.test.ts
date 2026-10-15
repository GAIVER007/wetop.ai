import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RESERVED_SITE_SLUGS } from '@pms/domain';

/**
 * Зарезервированные адреса сайта живут в двух местах: проверка API (`RESERVED_SITE_SLUGS`) и CHECK базы
 * `marketing_sites_slug_reserved` (миграция MKT3). Список один, расходиться им нельзя.
 */
describe('MKT3: зарезервированные адреса сайта в базе и в домене совпадают', () => {
  it('CHECK миграции 060 перечисляет ровно RESERVED_SITE_SLUGS', () => {
    const sql = readFileSync(
      resolve(__dirname, '../../packages/database/prisma/migrations/20261006000060_marketing_site_core/migration.sql'),
      'utf8',
    );
    const check = /marketing_sites_slug_reserved" CHECK \("slug" NOT IN \(([^)]*)\)\)/.exec(sql);
    expect(check, 'CHECK marketing_sites_slug_reserved в миграции').not.toBeNull();
    const inDb = [...check![1]!.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]).sort();
    expect(inDb).toEqual([...RESERVED_SITE_SLUGS].sort());
  });
});
