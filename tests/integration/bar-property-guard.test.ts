import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isLocalDatabase } from '../tools/seed-local';

/** BAR-REPAIR-2: real row types, direct SQL, synthetic data, localhost only. */
describe('BAR property guard: table-specific trigger dispatch', () => {
  let client: pg.Client;
  beforeAll(async () => {
    const url = process.env.DATABASE_URL;
    if (!url || !isLocalDatabase(url))
      throw new Error('BAR proof requires isolated localhost PostgreSQL');
    const schema = process.env.DATABASE_SCHEMA || 'public';
    client = new pg.Client({ connectionString: url, options: `-c search_path=${schema},public` });
    await client.connect();
  });
  afterAll(async () => {
    await client?.end();
  });

  async function fixture(run: (a: Side, b: Side) => Promise<void>) {
    await client.query('BEGIN');
    try {
      await run(await side('A'), await side('B'));
    } finally {
      await client.query('ROLLBACK');
    }
  }
  interface Side {
    property: string;
    category: string;
    supplier: string;
  }
  async function side(label: string): Promise<Side> {
    const [org, business, location, property, category, supplier] = Array.from({ length: 6 }, () =>
      randomUUID(),
    );
    await client.query(`INSERT INTO organizations (id,name) VALUES ($1,$2)`, [
      org,
      `BAR synthetic ${label}`,
    ]);
    await client.query(
      `INSERT INTO businesses (id,organization_id,name,vertical,updated_at) VALUES ($1,$2,$3,'HOSPITALITY',now())`,
      [business, org, `BAR synthetic ${label}`],
    );
    await client.query(
      `INSERT INTO locations (id,business_id,name,timezone,currency,updated_at) VALUES ($1,$2,$3,'Asia/Almaty','KZT',now())`,
      [location, business, `BAR synthetic ${label}`],
    );
    await client.query(
      `INSERT INTO properties (id,organization_id,location_id,name,timezone,currency,check_in_time,check_out_time,updated_at) VALUES ($1,$2,$3,$4,'Asia/Almaty','KZT','14:00','12:00',now())`,
      [property, org, location, `BAR synthetic ${label}`],
    );
    await client.query(
      `INSERT INTO bar_categories (id,property_id,name,default_markup_basis) VALUES ($1,$2,'synthetic',0)`,
      [category, property],
    );
    await client.query(
      `INSERT INTO bar_suppliers (id,property_id,name,updated_at) VALUES ($1,$2,'synthetic',now())`,
      [supplier, property],
    );
    return { property: property!, category: category!, supplier: supplier! };
  }
  async function product(a: Side, category: string | null = a.category) {
    const id = randomUUID();
    await client.query(
      `INSERT INTO bar_products (id,property_id,category_id,code,name,sale_price,updated_at) VALUES ($1::uuid,$2,$3,$1::text,'synthetic',100,now())`,
      [id, a.property, category],
    );
    return id;
  }
  async function receipt(a: Side, supplier = a.supplier) {
    const id = randomUUID();
    await client.query(
      `INSERT INTO bar_receipts (id,property_id,supplier_id,document_number,document_date,received_date,currency,total_amount,updated_at) VALUES ($1::uuid,$2,$3,$1::text,'2026-10-05','2026-10-05','KZT',100,now())`,
      [id, a.property, supplier],
    );
    return id;
  }
  it('product with own category succeeds without reading supplier_id', async () => {
    await fixture(async (a) => {
      await expect(product(a)).resolves.toBeTypeOf('string');
    });
  });
  it('product with null category succeeds', async () => {
    await fixture(async (a) => {
      await expect(product(a, null)).resolves.toBeTypeOf('string');
    });
  });
  it('product rejects foreign category', async () => {
    await fixture(async (a, b) => {
      await expect(product(a, b.category)).rejects.toThrow('Category belongs to another property');
    });
  });
  it('product rejects nonexistent category', async () => {
    await fixture(async (a) => {
      await expect(product(a, randomUUID())).rejects.toThrow(
        'Category belongs to another property',
      );
    });
  });
  it('product property update rejects previously own category', async () => {
    await fixture(async (a, b) => {
      const id = await product(a);
      await expect(
        client.query('UPDATE bar_products SET property_id=$1 WHERE id=$2', [b.property, id]),
      ).rejects.toThrow('Category belongs to another property');
    });
  });
  it('receipt with own supplier succeeds without reading category_id', async () => {
    await fixture(async (a) => {
      await expect(receipt(a)).resolves.toBeTypeOf('string');
    });
  });
  it('receipt rejects foreign supplier', async () => {
    await fixture(async (a, b) => {
      await expect(receipt(a, b.supplier)).rejects.toThrow('Supplier belongs to another property');
    });
  });
  it('receipt rejects nonexistent supplier', async () => {
    await fixture(async (a) => {
      await expect(receipt(a, randomUUID())).rejects.toThrow(
        'Supplier belongs to another property',
      );
    });
  });
  it('receipt rejects null supplier', async () => {
    await fixture(async (a) => {
      await expect(
        client.query(
          `INSERT INTO bar_receipts (id,property_id,supplier_id,document_number,document_date,received_date,currency,total_amount,updated_at) VALUES ($1,$2,NULL,'synthetic','2026-10-05','2026-10-05','KZT',100,now())`,
          [randomUUID(), a.property],
        ),
      ).rejects.toThrow('Supplier belongs to another property');
    });
  });
  it('receipt property update rejects previously own supplier', async () => {
    await fixture(async (a, b) => {
      const id = await receipt(a);
      await expect(
        client.query('UPDATE bar_receipts SET property_id=$1 WHERE id=$2', [b.property, id]),
      ).rejects.toThrow('Supplier belongs to another property');
    });
  });
  it('unknown table fails closed even with neither row-specific field', async () => {
    await fixture(async () => {
      await client.query('CREATE TEMP TABLE bar_unknown_probe (id uuid)');
      await client.query(
        'CREATE TRIGGER probe BEFORE INSERT ON bar_unknown_probe FOR EACH ROW EXECUTE FUNCTION bar_property_guard()',
      );
      await expect(
        client.query('INSERT INTO bar_unknown_probe VALUES ($1)', [randomUUID()]),
      ).rejects.toThrow('Unsupported table for bar_property_guard');
    });
  });
  it('search_path is pinned to owning schema, public, pg_temp', async () => {
    const { rows } = await client.query<{ schema: string; proconfig: string[] }>(
      `SELECT current_schema() AS schema, proconfig FROM pg_proc WHERE oid='bar_property_guard()'::regprocedure`,
    );
    const schema = rows[0]!.schema;
    expect(rows[0]!.proconfig).toContain(
      `search_path=${schema === 'public' ? 'public, pg_temp' : `${schema}, public, pg_temp`}`,
    );
  });
});
