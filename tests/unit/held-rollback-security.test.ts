import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const root = resolve(import.meta.dirname, '../../packages/database/prisma/migrations-hold');
const dirs = readdirSync(root).filter(x => /^2026101600011[4-8]_/.test(x)).sort();
describe('held rollback security boundaries', () => {
  it.each(dirs)('%s pins teardown to the locked schema without public fallback', d => {
    const sql = readFileSync(resolve(root, d, 'down.sql'), 'utf8');
    expect(sql).toContain("set_config('search_path',format('%I,pg_catalog,pg_temp',current_schema()),true)");
    expect(sql).toContain('SET TRANSACTION ISOLATION LEVEL READ COMMITTED;');
    expect(sql).not.toMatch(/\bCASCADE\b/);
    const tables = [...sql.matchAll(/DROP TABLE (\w+);/g)].map(x => x[1]);
    for (const t of tables) {
      expect(sql).toContain(`'ROLLBACK_RETAINED_DATA: ${t} `);
      expect(sql).toContain(`current_schema(),'${t}');`);
    }
  });
});
