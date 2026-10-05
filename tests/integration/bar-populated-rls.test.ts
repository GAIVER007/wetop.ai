import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isLocalDatabase } from '../tools/seed-local';

const tables = [
  'bar_categories',
  'bar_products',
  'bar_receipt_lines',
  'bar_receipts',
  'bar_sale_lines',
  'bar_sales',
  'bar_stock_lots',
  'bar_stock_movements',
  'bar_supplier_payments',
  'bar_suppliers',
] as const;
type BarTable = (typeof tables)[number];
interface Side {
  org: string;
  property: string;
  cash: string;
  rows: Record<BarTable, string>;
}

/** Real populated data under FORCE RLS, not just catalog assertions. All transactions roll back. */
describe('BAR populated tenant visibility and SQL ownership boundary', () => {
  let client: pg.Client;
  beforeAll(async () => {
    const url = process.env.DATABASE_URL;
    if (!url || !isLocalDatabase(url))
      throw new Error('BAR proof requires isolated localhost PostgreSQL');
    client = new pg.Client({
      connectionString: url,
      options: `-c search_path=${process.env.DATABASE_SCHEMA || 'public'},public`,
    });
    await client.connect();
  });
  afterAll(async () => {
    await client?.end();
  });
  async function insert(table: string, data: Record<string, string | number | null>) {
    const cols = Object.keys(data);
    return client.query(
      `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')})`,
      Object.values(data),
    );
  }
  async function side(label: string): Promise<Side> {
    const org = randomUUID(),
      business = randomUUID(),
      location = randomUUID(),
      property = randomUUID(),
      cash = randomUUID();
    const rows = Object.fromEntries(tables.map((t) => [t, randomUUID()])) as Record<
      BarTable,
      string
    >;
    const now = '2026-10-05T00:00:00Z';
    await insert('organizations', { id: org, name: `BAR synthetic ${label}` });
    await insert('businesses', {
      id: business,
      organization_id: org,
      name: `BAR synthetic ${label}`,
      vertical: 'HOSPITALITY',
      updated_at: now,
    });
    await insert('locations', {
      id: location,
      business_id: business,
      name: `BAR synthetic ${label}`,
      timezone: 'Asia/Almaty',
      currency: 'KZT',
      updated_at: now,
    });
    await insert('properties', {
      id: property,
      organization_id: org,
      location_id: location,
      name: `BAR synthetic ${label}`,
      timezone: 'Asia/Almaty',
      currency: 'KZT',
      check_in_time: '14:00',
      check_out_time: '12:00',
      updated_at: now,
    });
    await insert('bar_categories', {
      id: rows.bar_categories,
      property_id: property,
      name: 'synthetic',
      default_markup_basis: 0,
    });
    await insert('bar_suppliers', {
      id: rows.bar_suppliers,
      property_id: property,
      name: 'synthetic',
      updated_at: now,
    });
    await insert('bar_products', {
      id: rows.bar_products,
      property_id: property,
      category_id: rows.bar_categories,
      code: 'synthetic',
      name: 'synthetic',
      sale_price: '100',
      updated_at: now,
    });
    await insert('bar_receipts', {
      id: rows.bar_receipts,
      property_id: property,
      supplier_id: rows.bar_suppliers,
      document_number: 'synthetic',
      document_date: '2026-10-05',
      received_date: '2026-10-05',
      currency: 'KZT',
      total_amount: '100',
      updated_at: now,
    });
    await insert('bar_receipt_lines', {
      id: rows.bar_receipt_lines,
      receipt_id: rows.bar_receipts,
      product_id: rows.bar_products,
      quantity_units: '1',
      unit_cost: '100',
      amount: '100',
      markup_basis: 0,
      calculated_price: '100',
    });
    await insert('bar_stock_lots', {
      id: rows.bar_stock_lots,
      property_id: property,
      product_id: rows.bar_products,
      receipt_line_id: rows.bar_receipt_lines,
      received_units: '1',
      remaining_units: '1',
      unit_cost: '100',
      received_at: now,
    });
    await insert('bar_stock_movements', {
      id: rows.bar_stock_movements,
      property_id: property,
      product_id: rows.bar_products,
      lot_id: rows.bar_stock_lots,
      kind: 'RECEIPT',
      units: '1',
      unit_cost: '100',
      source_type: 'BAR_SYNTHETIC',
      source_id: rows.bar_receipts,
    });
    await insert('cash_operations', {
      id: cash,
      property_id: property,
      kind: 'EXPENSE',
      method: 'CASH',
      amount: '100',
    });
    await insert('bar_supplier_payments', {
      id: rows.bar_supplier_payments,
      receipt_id: rows.bar_receipts,
      cash_operation_id: cash,
      amount: '100',
      paid_at: now,
    });
    await insert('bar_sales', {
      id: rows.bar_sales,
      property_id: property,
      idempotency_key: 'synthetic',
      currency: 'KZT',
      total_revenue: '100',
      total_cost: '100',
    });
    await insert('bar_sale_lines', {
      id: rows.bar_sale_lines,
      sale_id: rows.bar_sales,
      product_id: rows.bar_products,
      quantity_units: '1',
      sale_price: '100',
      revenue: '100',
      cost: '100',
    });
    return { org, property, cash, rows };
  }
  async function fixture(run: (a: Side, b: Side) => Promise<void>) {
    await client.query('BEGIN');
    try {
      await run(await side('A'), await side('B'));
    } finally {
      await client.query('ROLLBACK');
    }
  }
  async function asRole<T>(
    role: 'wetop_app' | 'wetop_service',
    org: string | null,
    run: () => Promise<T>,
  ): Promise<T> {
    await client.query('SAVEPOINT role_probe');
    try {
      await client.query(`SET LOCAL ROLE ${role}`);
      if (org !== null) await client.query(`SELECT set_config('app.org_id',$1,true)`, [org]);
      return await run();
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT role_probe');
    }
  }

  it.each(tables)('%s: own=1, foreign=0; unset/empty=0; service=2', async (table) => {
    // PostgreSQL keeps a reset custom GUC as empty. A fresh session proves true absence for every table.
    await client.end();
    client = new pg.Client({
      connectionString: process.env.DATABASE_URL,
      options: `-c search_path=${process.env.DATABASE_SCHEMA || 'public'},public`,
    });
    await client.connect();
    const setting = await client.query<{ org: string | null }>(
      `SELECT current_setting('app.org_id',true) AS org`,
    );
    expect(setting.rows[0]!.org).toBeNull();
    await fixture(async (a, b) => {
      const ids = [a.rows[table], b.rows[table]];
      const read = async () =>
        (
          await client.query<{ id: string }>(
            `SELECT id FROM "${table}" WHERE id = ANY($1::uuid[]) ORDER BY id`,
            [ids],
          )
        ).rows.map((r) => r.id);
      const missing = await asRole('wetop_app', null, read);
      expect(missing).toEqual([]);
      const empty = await asRole('wetop_app', '', read);
      expect(empty).toEqual([]);
      const ownA = await asRole('wetop_app', a.org, read);
      expect(ownA).toEqual([a.rows[table]]);
      const ownB = await asRole('wetop_app', b.org, read);
      expect(ownB).toEqual([b.rows[table]]);
      const service = await asRole('wetop_service', '', read);
      expect(service).toEqual([...ids].sort());
      console.log(`BAR_COUNTS ${table} A=[1,0] B=[0,1] unset=[0,0] empty=[0,0] service=[1,1]`);
    });
  });
  it('all ten tables FORCE RLS; service has BYPASSRLS; app has no bypass', async () => {
    const flags = (
      await client.query<{
        relname: string;
        relrowsecurity: boolean;
        relforcerowsecurity: boolean;
      }>(
        `SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relnamespace=current_schema()::regnamespace AND relname=ANY($1::text[])`,
        [[...tables]],
      )
    ).rows;
    expect(flags).toHaveLength(10);
    expect(flags.every((r) => r.relrowsecurity && r.relforcerowsecurity)).toBe(true);
    const roles = (
      await client.query<{ rolname: string; rolbypassrls: boolean; rolsuper: boolean }>(
        `SELECT rolname,rolbypassrls,rolsuper FROM pg_roles WHERE rolname IN ('wetop_app','wetop_service') ORDER BY rolname`,
      )
    ).rows;
    expect(roles).toEqual([
      { rolname: 'wetop_app', rolbypassrls: false, rolsuper: false },
      { rolname: 'wetop_service', rolbypassrls: true, rolsuper: false },
    ]);
  });

  it.each(['bar_products', 'bar_suppliers', 'bar_receipts', 'bar_sales'] as const)(
    '%s: app A cannot create a row in property B',
    async (table) => {
      await fixture(async (a, b) => {
        await asRole('wetop_app', a.org, async () => {
          // Clone B row with a new key. Null optional relation prevents unrelated uniqueness conflicts.
          const columns: Record<typeof table, string> = {
            bar_products: 'id,property_id,code,name,sale_price,updated_at',
            bar_suppliers: 'id,property_id,name,updated_at',
            bar_receipts:
              'id,property_id,supplier_id,document_number,document_date,received_date,currency,total_amount,updated_at',
            bar_sales: 'id,property_id,idempotency_key,currency,total_revenue,total_cost',
          };
          const values: Record<typeof table, string> = {
            bar_products: `$1,$2,'foreign','synthetic',100,now()`,
            bar_suppliers: `$1,$2,'foreign',now()`,
            bar_receipts: `$1,$2,$3,'foreign','2026-10-05','2026-10-05','KZT',100,now()`,
            bar_sales: `$1,$2,'foreign','KZT',100,100`,
          };
          const params =
            table === 'bar_receipts'
              ? [randomUUID(), b.property, b.rows.bar_suppliers]
              : [randomUUID(), b.property];
          const sql = `INSERT INTO ${table} (${columns[table]}) VALUES (${values[table]})`;
          // Receipt's invoker guard cannot see B's supplier and may deny before the RLS check.
          await expect(client.query(sql, params)).rejects.toThrow(
            /row-level security|Supplier belongs to another property/,
          );
        });
      });
    },
  );

  const childCases = [
    [
      'receipt line foreign product',
      'UPDATE bar_receipt_lines SET product_id=$1 WHERE id=$2',
      'bar_products',
      'bar_receipt_lines',
    ],
    [
      'lot foreign product',
      'UPDATE bar_stock_lots SET product_id=$1 WHERE id=$2',
      'bar_products',
      'bar_stock_lots',
    ],
    [
      'movement foreign product',
      'UPDATE bar_stock_movements SET product_id=$1 WHERE id=$2',
      'bar_products',
      'bar_stock_movements',
    ],
    [
      'movement foreign lot',
      'UPDATE bar_stock_movements SET lot_id=$1 WHERE id=$2',
      'bar_stock_lots',
      'bar_stock_movements',
    ],
    [
      'supplier payment foreign receipt',
      'UPDATE bar_supplier_payments SET receipt_id=$1 WHERE id=$2',
      'bar_receipts',
      'bar_supplier_payments',
    ],
    [
      'supplier payment foreign cash',
      'UPDATE bar_supplier_payments SET cash_operation_id=$1 WHERE id=$2',
      'cash',
      'bar_supplier_payments',
    ],
    [
      'sale line foreign product',
      'UPDATE bar_sale_lines SET product_id=$1 WHERE id=$2',
      'bar_products',
      'bar_sale_lines',
    ],
  ] as const;
  it.each(childCases)('ownership denies %s', async (_name, sql, foreign, target) => {
    await fixture(async (a, b) => {
      let id = foreign === 'cash' ? b.cash : b.rows[foreign];
      if (foreign === 'cash') {
        id = randomUUID();
        await insert('cash_operations', {
          id,
          property_id: b.property,
          kind: 'EXPENSE',
          method: 'CASH',
          amount: '100',
        });
      }
      await asRole('wetop_app', a.org, async () => {
        const expected = {
          bar_receipt_lines: 'BAR receipt line ownership mismatch',
          bar_stock_lots: 'BAR stock lot ownership mismatch',
          bar_stock_movements:
            foreign === 'bar_stock_lots'
              ? 'BAR stock movement lot ownership mismatch'
              : 'BAR stock movement product ownership mismatch',
          bar_supplier_payments: 'BAR supplier payment ownership mismatch',
          bar_sale_lines: 'BAR sale line ownership mismatch',
        }[target];
        await expect(client.query(sql, [id, a.rows[target]])).rejects.toThrow(expected);
      });
    });
  });
  it('ownership denies lot property A referencing a new receipt line in B', async () => {
    await fixture(async (a, b) => {
      const receipt = randomUUID(),
        line = randomUUID();
      await client.query(
        `INSERT INTO bar_receipts (id,property_id,supplier_id,document_number,document_date,received_date,currency,total_amount,updated_at) VALUES ($1,$2,$3,'extra','2026-10-05','2026-10-05','KZT',100,now())`,
        [receipt, b.property, b.rows.bar_suppliers],
      );
      await insert('bar_receipt_lines', {
        id: line,
        receipt_id: receipt,
        product_id: b.rows.bar_products,
        quantity_units: '1',
        unit_cost: '100',
        amount: '100',
        markup_basis: 0,
        calculated_price: '100',
      });
      await asRole('wetop_app', a.org, async () => {
        await expect(
          client.query('UPDATE bar_stock_lots SET receipt_line_id=$1 WHERE id=$2', [
            line,
            a.rows.bar_stock_lots,
          ]),
        ).rejects.toThrow('BAR stock lot ownership mismatch');
      });
    });
  });
  it('ownership denies direct INSERT of own receipt line with foreign product', async () => {
    await fixture(async (a, b) => {
      await asRole('wetop_app', a.org, async () => {
        await expect(
          insert('bar_receipt_lines', {
            id: randomUUID(),
            receipt_id: a.rows.bar_receipts,
            product_id: b.rows.bar_products,
            quantity_units: '1',
            unit_cost: '100',
            amount: '100',
            markup_basis: 0,
            calculated_price: '100',
          }),
        ).rejects.toThrow('BAR receipt line ownership mismatch');
      });
    });
  });
});
