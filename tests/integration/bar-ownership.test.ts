import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isLocalDatabase } from '../tools/seed-local';
import { barProofFixture, type BarTable, type Side } from '../tools/bar-proof-fixture';

type LinkCase = {
  name: string;
  table: BarTable;
  patch: (a: Side, b: Side) => Record<string, unknown>;
};
const linkCases: LinkCase[] = [
  {
    name: 'receipt line foreign product',
    table: 'bar_receipt_lines',
    patch: (_a, b) => ({ product_id: b.rows.bar_products }),
  },
  {
    name: 'receipt line foreign receipt',
    table: 'bar_receipt_lines',
    patch: (_a, b) => ({ receipt_id: b.spare.receipt }),
  },
  {
    name: 'lot foreign product',
    table: 'bar_stock_lots',
    patch: (_a, b) => ({ product_id: b.rows.bar_products }),
  },
  {
    name: 'lot foreign receipt line',
    table: 'bar_stock_lots',
    patch: (_a, b) => ({ receipt_line_id: b.spare.unlinkedLine }),
  },
  {
    name: 'lot same-property wrong product',
    table: 'bar_stock_lots',
    patch: (a) => ({ product_id: a.spare.product }),
  },
  {
    name: 'lot same-property wrong receipt-line product',
    table: 'bar_stock_lots',
    patch: (a) => ({ receipt_line_id: a.spare.line }),
  },
  {
    name: 'movement foreign product',
    table: 'bar_stock_movements',
    patch: (_a, b) => ({ product_id: b.rows.bar_products }),
  },
  {
    name: 'movement foreign lot',
    table: 'bar_stock_movements',
    patch: (_a, b) => ({ lot_id: b.rows.bar_stock_lots }),
  },
  {
    name: 'movement same-property wrong lot product',
    table: 'bar_stock_movements',
    patch: (a) => ({ lot_id: a.spare.lot }),
  },
  {
    name: 'movement same-property wrong product',
    table: 'bar_stock_movements',
    patch: (a) => ({ product_id: a.spare.product }),
  },
  {
    name: 'sale line foreign product',
    table: 'bar_sale_lines',
    patch: (_a, b) => ({ product_id: b.rows.bar_products }),
  },
  {
    name: 'sale line foreign sale',
    table: 'bar_sale_lines',
    patch: (_a, b) => ({ sale_id: b.spare.sale }),
  },
  {
    name: 'payment foreign receipt',
    table: 'bar_supplier_payments',
    patch: (_a, b) => ({ receipt_id: b.spare.receipt }),
  },
  {
    name: 'payment foreign unused cash',
    table: 'bar_supplier_payments',
    patch: (_a, b) => ({ cash_operation_id: b.unusedCash }),
  },
  { name: 'sale foreign folio', table: 'bar_sales', patch: (_a, b) => ({ folio_id: b.folios[0] }) },
  {
    name: 'sale foreign unused cash',
    table: 'bar_sales',
    patch: (_a, b) => ({ cash_operation_id: b.unusedCash }),
  },
  {
    name: 'sale foreign charge without folio',
    table: 'bar_sales',
    patch: (_a, b) => ({ charge_id: b.charges[0] }),
  },
  {
    name: 'sale charge mismatches own folio',
    table: 'bar_sales',
    patch: (a) => ({ folio_id: a.folios[0], charge_id: a.charges[1] }),
  },
];
const propertyTables: BarTable[] = [
  'bar_categories',
  'bar_products',
  'bar_suppliers',
  'bar_receipts',
  'bar_stock_lots',
  'bar_stock_movements',
  'bar_sales',
];
const roles = ['wetop_app', 'wetop_service'] as const;
const deny = /BAR .*ownership|BAR property_id is immutable|row-level security/i;

describe('BAR ownership: invoker guards apply to app and BYPASSRLS service', () => {
  let client: pg.Client;
  let proof: ReturnType<typeof barProofFixture>;
  beforeAll(async () => {
    const url = process.env.DATABASE_URL;
    if (!url || !isLocalDatabase(url))
      throw new Error('BAR proof requires isolated localhost PostgreSQL');
    client = new pg.Client({
      connectionString: url,
      options: `-c search_path=${process.env.DATABASE_SCHEMA || 'public'},public`,
    });
    await client.connect();
    proof = barProofFixture(client);
  });
  afterAll(async () => {
    await client?.end();
  });
  async function update(table: BarTable, id: string, patch: Record<string, unknown>) {
    return client.query(
      `UPDATE ${table} SET ${Object.keys(patch)
        .map((c, i) => `${c}=$${i + 1}`)
        .join(',')} WHERE id=$${Object.keys(patch).length + 1}`,
      [...Object.values(patch), id],
    );
  }
  // Free outgoing row references so INSERT tests fail for ownership, never accidental uniqueness.
  async function removeTarget(table: BarTable, a: Side) {
    if (table === 'bar_receipt_lines') {
      await client.query('DELETE FROM bar_stock_movements WHERE lot_id=$1', [
        a.rows.bar_stock_lots,
      ]);
      await client.query('DELETE FROM bar_stock_lots WHERE id=$1', [a.rows.bar_stock_lots]);
    }
    if (table === 'bar_stock_lots')
      await client.query('DELETE FROM bar_stock_movements WHERE lot_id=$1', [
        a.rows.bar_stock_lots,
      ]);
    if (table === 'bar_sales')
      await client.query('DELETE FROM bar_sale_lines WHERE sale_id=$1', [a.rows.bar_sales]);
    await client.query(`DELETE FROM ${table} WHERE id=$1`, [a.rows[table]]);
  }
  it('new guards are invokers with exact owning-schema/public/pg_temp pinned paths', async () => {
    const { rows } = await client.query<{
      name: string;
      prosecdef: boolean;
      proconfig: string[];
      schema: string;
    }>(
      `SELECT p.proname AS name,p.prosecdef,p.proconfig,current_schema() AS schema FROM pg_proc p WHERE p.pronamespace=current_schema()::regnamespace AND p.proname=ANY($1::text[]) ORDER BY p.proname`,
      [['bar_child_ownership_guard', 'bar_property_immutable_guard', 'bar_sale_links_guard']],
    );
    expect(rows.map((r) => r.name)).toEqual([
      'bar_child_ownership_guard',
      'bar_property_immutable_guard',
      'bar_sale_links_guard',
    ]);
    for (const row of rows) {
      expect(row.prosecdef).toBe(false);
      expect(row.proconfig).toContain(
        `search_path=${row.schema === 'public' ? 'public, pg_temp' : `${row.schema}, public, pg_temp`}`,
      );
    }
  });
  for (const role of roles) {
    for (const operation of ['INSERT', 'UPDATE'] as const) {
      it.each(linkCases)(`${role} ${operation} denies $name`, async ({ table, patch }) => {
        await proof.fixture(async (a, b) => {
          const original = (
            await client.query(`SELECT * FROM ${table} WHERE id=$1`, [a.rows[table]])
          ).rows[0] as Record<string, unknown>;
          if (operation === 'INSERT') await removeTarget(table, a);
          // The alternate same-property line must be unused by another lot to avoid uniqueness masking.
          if (table === 'bar_stock_lots' && patch(a, b).receipt_line_id === a.spare.line) {
            await client.query('DELETE FROM bar_stock_lots WHERE id=$1', [a.spare.lot]);
          }
          await proof.asRole(role, a.org, async () => {
            const write =
              operation === 'INSERT'
                ? proof.insert(table, { ...original, ...patch(a, b), id: randomUUID() })
                : update(table, a.rows[table], patch(a, b));
            await expect(write).rejects.toThrow(deny);
          });
        });
      });
    }
    it.each(propertyTables)(
      `${role} denies reassignment of %s to another visible Property`,
      async (table) => {
        await proof.fixture(async (a) => {
          // Detach optional category for product: before 56 the old category guard must not mask reassignment.
          if (table === 'bar_products')
            await client.query('UPDATE bar_products SET category_id=NULL WHERE id=$1', [
              a.rows[table],
            ]);
          const id = a.rows[table];
          const patch: Record<string, unknown> = { property_id: a.secondProperty };
          if (table === 'bar_receipts') {
            const supplier = randomUUID();
            await proof.insert('bar_suppliers', {
              id: supplier,
              property_id: a.secondProperty,
              name: 'second property',
              updated_at: '2026-10-05T00:00:00Z',
            });
            patch.supplier_id = supplier;
          }
          await proof.asRole(role, a.org, async () => {
            await expect(update(table, id, patch)).rejects.toThrow(deny);
          });
        });
      },
    );
    it.each([
      'bar_receipt_lines',
      'bar_stock_lots',
      'bar_stock_movements',
      'bar_sale_lines',
      'bar_supplier_payments',
      'bar_sales',
    ] as const)(`${role}: %s own INSERT and actual relation UPDATE succeeds`, async (table) => {
      await proof.fixture(async (a) => {
        const original = (await client.query(`SELECT * FROM ${table} WHERE id=$1`, [a.rows[table]]))
          .rows[0] as Record<string, unknown>;
        if (table === 'bar_sales')
          Object.assign(original, {
            folio_id: a.folios[0],
            charge_id: a.charges[0],
            cash_operation_id: a.unusedCash,
          });
        await removeTarget(table, a);
        if (table === 'bar_receipt_lines')
          await client.query('DELETE FROM bar_receipt_lines WHERE id=$1', [a.spare.unlinkedLine]);
        if (table === 'bar_stock_lots')
          await client.query('DELETE FROM bar_stock_lots WHERE id=$1', [a.spare.lot]);
        const patches: Partial<Record<BarTable, Record<string, unknown>>> = {
          bar_receipt_lines: { receipt_id: a.spare.receipt, product_id: a.rows.bar_products },
          bar_stock_lots: { receipt_line_id: a.spare.line, product_id: a.spare.product },
          bar_stock_movements: { lot_id: a.spare.lot, product_id: a.spare.product },
          bar_sale_lines: { sale_id: a.spare.sale, product_id: a.spare.product },
          bar_supplier_payments: { receipt_id: a.spare.receipt, cash_operation_id: a.unusedCash },
          bar_sales: {
            folio_id: a.folios[0],
            charge_id: a.charges[0],
            cash_operation_id: a.unusedCash,
          },
        };
        await proof.asRole(role, a.org, async () => {
          await expect(proof.insert(table, original)).resolves.toMatchObject({ rowCount: 1 });
          await expect(update(table, a.rows[table], patches[table]!)).resolves.toMatchObject({
            rowCount: 1,
          });
          if (table === 'bar_stock_movements')
            await expect(update(table, a.rows[table], { lot_id: null })).resolves.toMatchObject({
              rowCount: 1,
            });
          if (table === 'bar_sales')
            await expect(
              update(table, a.rows[table], { folio_id: a.folios[1], charge_id: a.charges[1] }),
            ).resolves.toMatchObject({ rowCount: 1 });
        });
      });
    });
    it(`${role}: own category/supplier changes and property no-op updates succeed`, async () => {
      await proof.fixture(async (a) => {
        await proof.asRole(role, a.org, async () => {
          const category = randomUUID(),
            supplier = randomUUID();
          await proof.insert('bar_categories', {
            id: category,
            property_id: a.property,
            name: 'spare',
            default_markup_basis: 0,
          });
          await proof.insert('bar_suppliers', {
            id: supplier,
            property_id: a.property,
            name: 'spare',
            updated_at: '2026-10-05T00:00:00Z',
          });
          await expect(
            update('bar_products', a.rows.bar_products, { category_id: category }),
          ).resolves.toMatchObject({ rowCount: 1 });
          await expect(
            update('bar_receipts', a.rows.bar_receipts, { supplier_id: supplier }),
          ).resolves.toMatchObject({ rowCount: 1 });
          for (const table of propertyTables)
            await expect(
              update(table, a.rows[table], { property_id: a.property }),
            ).resolves.toMatchObject({ rowCount: 1 });
        });
      });
    });
    it(`${role}: receipt line product edit cannot invalidate an existing lot`, async () => {
      await proof.fixture(async (a) => {
        await proof.asRole(role, a.org, async () => {
          await expect(
            update('bar_receipt_lines', a.rows.bar_receipt_lines, { product_id: a.spare.product }),
          ).rejects.toThrow(deny);
        });
      });
    });
    it(`${role}: lot product edit cannot invalidate an existing movement`, async () => {
      await proof.fixture(async (a) => {
        await client.query('DELETE FROM bar_stock_lots WHERE id=$1', [a.spare.lot]);
        await proof.asRole(role, a.org, async () => {
          await expect(
            update('bar_stock_lots', a.rows.bar_stock_lots, {
              product_id: a.spare.product,
              receipt_line_id: a.spare.line,
            }),
          ).rejects.toThrow(deny);
        });
      });
    });
  }
});
