import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { isLocalDatabase } from '../tools/seed-local';

const url = process.env.DATABASE_URL;
describe.skipIf(!url)('cash shift ACL after backup restoration', () => {
  it('restores the exact metadata grants without replaying the table migration', async () => {
    if (!isLocalDatabase(url!)) throw new Error('Requires isolated localhost PostgreSQL');
    // схема набора (в гейте pms_test), как в rls-credential-grants.test.ts
    const schema = process.env.DATABASE_SCHEMA?.trim() || 'public';
    const db = new pg.Client({ connectionString: url, options: `-c search_path=${schema},public` });
    await db.connect();
    try {
      await db.query('BEGIN');
      await db.query(
        'REVOKE ALL ON cash_registers,cash_shifts,cash_handovers,cash_commands FROM PUBLIC,wetop_app,wetop_service',
      );
      await db.query(
        'REVOKE ALL ON FUNCTION cash_scope_visible(uuid,uuid) FROM PUBLIC,wetop_app,wetop_service',
      );
      await db.query(
        readFileSync(
          resolve(import.meta.dirname, '../../scripts/ops/restore-mixed-domain-grants.sql'),
          'utf8',
        ),
      );
      for (const role of ['wetop_app', 'wetop_service']) {
        const {
          rows: [grants],
        } = await db.query(
          `SELECT has_table_privilege($1,$2::text||'.cash_registers','SELECT') readable,
          has_table_privilege($1,$2::text||'.cash_shifts','INSERT') writable,
          has_table_privilege($1,$2::text||'.cash_commands','UPDATE') mutable,
          has_table_privilege($1,$2::text||'.cash_handovers','DELETE') deletable,
          has_function_privilege($1,$2::text||'.cash_scope_visible(uuid,uuid)','EXECUTE') executable`,
          [role, schema],
        );
        expect(grants).toEqual({
          readable: true,
          writable: true,
          mutable: false,
          deletable: false,
          executable: true,
        });
      }
    } finally {
      await db.query('ROLLBACK');
      await db.end();
    }
  });
});
