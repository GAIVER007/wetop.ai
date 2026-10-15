import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Бар на филиале (DATA_MODEL §44, ADR-178): бар ресторана без объекта гостиницы, объект только своего филиала,
 * деньги гостиницы только у бара с объектом, владение по филиалу, RLS по организации филиала. Синтетика, откат.
 */
describe('BAR on locations (§44)', () => {
  let client: pg.Client;
  beforeAll(async () => {
    const url = process.env.DATABASE_URL;
    if (!url || !isLocalDatabase(url)) throw new Error('BAR proof requires isolated localhost PostgreSQL');
    client = new pg.Client({
      connectionString: url,
      options: `-c search_path=${process.env.DATABASE_SCHEMA || 'public'},public`,
    });
    await client.connect();
  });
  afterAll(async () => {
    await client?.end();
  });
  async function rollback(run: () => Promise<void>) {
    await client.query('BEGIN');
    try {
      await run();
    } finally {
      await client.query('ROLLBACK');
    }
  }
  async function savepoint(run: () => Promise<void>) {
    await client.query('SAVEPOINT probe');
    try {
      await run();
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT probe');
    }
  }
  /** Организация с бизнесом и филиалом; у гостиницы ещё объект */
  async function branch(vertical: 'HOSPITALITY' | 'FOOD_SERVICE') {
    const [org, business, location, property] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    await client.query(`INSERT INTO organizations (id,name) VALUES ($1,'BAR location synthetic')`, [org]);
    await client.query(
      `INSERT INTO businesses (id,organization_id,name,vertical,updated_at) VALUES ($1,$2,'BAR location synthetic',$3,now())`,
      [business, org, vertical],
    );
    await client.query(
      `INSERT INTO locations (id,business_id,name,timezone,currency,updated_at) VALUES ($1,$2,'BAR location synthetic','Asia/Almaty','KZT',now())`,
      [location, business],
    );
    if (vertical === 'HOSPITALITY')
      await client.query(
        `INSERT INTO properties (id,organization_id,location_id,name,timezone,currency,check_in_time,check_out_time,updated_at) VALUES ($1,$2,$3,$4,'Asia/Almaty','KZT','14:00','12:00',now())`,
        [property, org, location, `BAR location ${property}`],
      );
    return { org, location, property: vertical === 'HOSPITALITY' ? property : null };
  }
  const category = async (location: string, property: string | null = null) => {
    const id = randomUUID();
    await client.query(
      `INSERT INTO bar_categories (id,location_id,property_id,name,default_markup_basis) VALUES ($1,$2,$3,$4,0)`,
      [id, location, property, `category ${id}`],
    );
    return id;
  };

  it('бар ресторана живёт без объекта гостиницы; у гостиничной строки филиал берётся из объекта', () =>
    rollback(async () => {
      const food = await branch('FOOD_SERVICE');
      const id = await category(food.location);
      const row = await client.query('SELECT location_id, property_id FROM bar_categories WHERE id=$1', [id]);
      expect(row.rows[0]).toEqual({ location_id: food.location, property_id: null });
      const hotel = await branch('HOSPITALITY');
      const hid = randomUUID();
      await client.query(
        `INSERT INTO bar_categories (id,property_id,name,default_markup_basis) VALUES ($1,$2,'hotel',0)`,
        [hid, hotel.property],
      );
      const filled = await client.query('SELECT location_id FROM bar_categories WHERE id=$1', [hid]);
      expect(filled.rows[0].location_id).toBe(hotel.location);
    }));

  it('объект гостиницы чужого филиала не принимается; филиал и объект неизменны', () =>
    rollback(async () => {
      const food = await branch('FOOD_SERVICE');
      const hotel = await branch('HOSPITALITY');
      await savepoint(async () => {
        await expect(category(food.location, hotel.property)).rejects.toThrow('BAR property belongs to another location');
      });
      const id = await category(food.location);
      await savepoint(async () => {
        await expect(
          client.query('UPDATE bar_categories SET location_id=$1 WHERE id=$2', [hotel.location, id]),
        ).rejects.toThrow('BAR property_id is immutable');
      });
    }));

  it('владение по филиалу: товар с категорией другого филиала отклоняется', () =>
    rollback(async () => {
      const a = await branch('FOOD_SERVICE');
      const b = await branch('FOOD_SERVICE');
      const foreign = await category(b.location);
      await expect(
        client.query(
          `INSERT INTO bar_products (id,location_id,category_id,code,name,sale_price,updated_at) VALUES ($1::uuid,$2,$3,$1::text,'synthetic',100,now())`,
          [randomUUID(), a.location, foreign],
        ),
      ).rejects.toThrow('Category belongs to another property');
    }));

  it('продажа без объекта не связывается с кассой гостиницы', () =>
    rollback(async () => {
      const food = await branch('FOOD_SERVICE');
      const hotel = await branch('HOSPITALITY');
      const cash = randomUUID();
      await client.query(
        `INSERT INTO cash_operations (id,property_id,kind,method,amount) VALUES ($1,$2,'INCOME','CASH',100)`,
        [cash, hotel.property],
      );
      await expect(
        client.query(
          `INSERT INTO bar_sales (id,location_id,cash_operation_id,idempotency_key,currency,total_revenue,total_cost) VALUES ($1,$2,$3,'k','KZT',100,50)`,
          [randomUUID(), food.location, cash],
        ),
      ).rejects.toThrow('BAR sale hotel money links require a property');
    }));

  it('RLS: чужая организация не видит бар ресторана и не пишет в его филиал', () =>
    rollback(async () => {
      const food = await branch('FOOD_SERVICE');
      const other = await branch('FOOD_SERVICE');
      await category(food.location);
      await client.query('SET LOCAL ROLE wetop_app');
      await client.query(`SELECT set_config('app.org_id',$1,true)`, [other.org]);
      const seen = await client.query('SELECT count(*)::int n FROM bar_categories WHERE location_id=$1', [food.location]);
      expect(seen.rows[0].n).toBe(0);
      await expect(category(food.location)).rejects.toThrow(/row-level security/);
    }));
});
