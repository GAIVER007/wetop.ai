import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isLocalDatabase } from '../tools/seed-local';

/** Склад кухни FS2 (DATA_MODEL §34, ADR-KITCHEN-FS): RLS, принадлежность, лента только дописывается, откат */
const url = process.env.DATABASE_URL;
const schema = () => process.env.DATABASE_SCHEMA || 'public';
const tables = ['kitchen_products', 'kitchen_stock_lots', 'kitchen_stock_movements'] as const;

describe.skipIf(!url)('Kitchen stock: RLS, ownership, append-only ledger', () => {
  let db: pg.Client;
  beforeAll(async () => {
    if (!isLocalDatabase(url!)) throw new Error('Requires isolated localhost PostgreSQL');
    db = new pg.Client({ connectionString: url, options: `-c search_path=${schema()},public` });
    await db.connect();
  });
  afterAll(async () => {
    await db?.end();
  });
  async function rollback(fn: () => Promise<void>) {
    await db.query('BEGIN');
    try {
      await fn();
    } finally {
      await db.query('ROLLBACK');
    }
  }
  async function savepoint(fn: () => Promise<void>) {
    await db.query('SAVEPOINT probe');
    try {
      await fn();
    } finally {
      await db.query('ROLLBACK TO SAVEPOINT probe');
    }
  }
  async function seed(vertical = 'FOOD_SERVICE') {
    const ids = { org: randomUUID(), biz: randomUUID(), loc: randomUUID(), product: randomUUID(), lot: randomUUID(), move: randomUUID() };
    await db.query(`INSERT INTO organizations(id,name) VALUES($1,'Kitchen stock synthetic')`, [ids.org]);
    await db.query(
      `INSERT INTO businesses(id,organization_id,name,vertical,updated_at) VALUES($1,$2,'Kitchen synthetic',$3,now())`,
      [ids.biz, ids.org, vertical],
    );
    await db.query(
      `INSERT INTO locations(id,business_id,name,timezone,currency,updated_at) VALUES($1,$2,'Kitchen synthetic','Asia/Almaty','KZT',now())`,
      [ids.loc, ids.biz],
    );
    if (vertical !== 'FOOD_SERVICE') return ids;
    await db.query(
      `INSERT INTO kitchen_products(id,business_id,name,unit,updated_at) VALUES($1,$2,'Говядина','г',now())`,
      [ids.product, ids.biz],
    );
    await db.query(
      `INSERT INTO kitchen_stock_lots(id,location_id,product_id,received_on,received_qty,remaining_qty,unit_cost,updated_at) VALUES($1,$2,$3,'2026-10-10',5000,5000,600000,now())`,
      [ids.lot, ids.loc, ids.product],
    );
    await db.query(
      `INSERT INTO kitchen_stock_movements(id,location_id,product_id,lot_id,kind,qty,cost) VALUES($1,$2,$3,$4,'RECEIPT',5000,300000000)`,
      [ids.move, ids.loc, ids.product, ids.lot],
    );
    return ids;
  }

  it('три таблицы: свои строки видны, чужой и пустой арендатор не видят, сервис видит всех', async () =>
    rollback(async () => {
      const own = await seed(),
        other = await seed();
      const keys = [own.product, own.lot, own.move];
      const foreign = [other.product, other.lot, other.move];
      for (const [i, table] of tables.entries()) {
        for (const tenant of [own.org, other.org, ''])
          await savepoint(async () => {
            await db.query('SET LOCAL ROLE wetop_app');
            await db.query(`SELECT set_config('app.org_id',$1,true)`, [tenant]);
            const r = await db.query(`SELECT id FROM ${table} WHERE id=ANY($1::uuid[])`, [[keys[i], foreign[i]]]);
            expect(r.rows.map((x: { id: string }) => x.id)).toEqual(
              tenant === own.org ? [keys[i]] : tenant === other.org ? [foreign[i]] : [],
            );
          });
        await savepoint(async () => {
          await db.query('SET LOCAL ROLE wetop_service');
          expect((await db.query(`SELECT id FROM ${table} WHERE id=ANY($1::uuid[])`, [[keys[i], foreign[i]]])).rowCount).toBe(2);
        });
      }
    }));

  it('лента только дописывается: у ролей нет UPDATE и DELETE, а владельцу мешает триггер', async () =>
    rollback(async () => {
      const own = await seed();
      const grants = await db.query(
        `SELECT grantee, privilege_type FROM information_schema.role_table_grants
          WHERE table_schema=$1 AND table_name='kitchen_stock_movements' AND grantee IN ('wetop_app','wetop_service')`,
        [schema()],
      );
      const privs = grants.rows.map((r: { grantee: string; privilege_type: string }) => `${r.grantee}:${r.privilege_type}`);
      for (const role of ['wetop_app', 'wetop_service']) {
        expect(privs).toContain(`${role}:SELECT`);
        expect(privs).toContain(`${role}:INSERT`);
        expect(privs).not.toContain(`${role}:UPDATE`);
        expect(privs).not.toContain(`${role}:DELETE`);
      }
      await savepoint(async () => {
        await expect(db.query(`UPDATE kitchen_stock_movements SET qty=1 WHERE id=$1`, [own.move])).rejects.toThrow(/только дописывается/);
      });
      await savepoint(async () => {
        await expect(db.query(`DELETE FROM kitchen_stock_movements WHERE id=$1`, [own.move])).rejects.toThrow(/только дописывается/);
      });
      await savepoint(async () => {
        await db.query(`SELECT set_config('wetop.audit_purge','on',true)`);
        expect((await db.query(`DELETE FROM kitchen_stock_movements WHERE id=$1`, [own.move])).rowCount).toBe(1);
      });
    }));

  it('принадлежность: склад доступен Food и Beauty, но отклоняет Hospitality и чужие связи', async () =>
    rollback(async () => {
      const own = await seed(),
        other = await seed();
      const beauty = await seed('BEAUTY');
      const hospitality = await seed('HOSPITALITY');
      await savepoint(async () => {
        await expect(db.query(
          `INSERT INTO kitchen_products(id,business_id,name,unit,updated_at) VALUES($1,$2,'Соль','г',now())`,
          [randomUUID(), beauty.biz],
        )).resolves.toMatchObject({ rowCount: 1 });
      });
      await savepoint(async () => {
        await expect(db.query(
          `INSERT INTO kitchen_products(id,business_id,name,unit,updated_at) VALUES($1,$2,'Соль','г',now())`,
          [randomUUID(), hospitality.biz],
        )).rejects.toThrow(/Food or Beauty business required/);
      });
      await savepoint(async () => {
        await expect(
          db.query(
            `INSERT INTO kitchen_stock_lots(id,location_id,product_id,received_on,received_qty,remaining_qty,unit_cost,updated_at) VALUES($1,$2,$3,'2026-10-10',1,1,1,now())`,
            [randomUUID(), own.loc, other.product],
          ),
        ).rejects.toThrow(/another business/);
      });
      await savepoint(async () => {
        await expect(
          db.query(`INSERT INTO kitchen_stock_movements(id,location_id,product_id,lot_id,kind,qty,cost) VALUES($1,$2,$3,$4,'WRITE_OFF',-1,-1)`, [
            randomUUID(),
            own.loc,
            own.product,
            other.lot,
          ]),
        ).rejects.toThrow(/another location or product/);
      });
      await savepoint(async () => {
        await expect(db.query(`UPDATE kitchen_stock_lots SET product_id=$1 WHERE id=$2`, [other.product, own.lot])).rejects.toThrow(
          /immutable|another business/,
        );
      });
    }));

  it('CHECK: остаток не больше прихода и не ниже нуля, единица только г, мл, шт, нулевое движение нельзя', async () =>
    rollback(async () => {
      const own = await seed();
      for (const [sql, args] of [
        [`UPDATE kitchen_stock_lots SET remaining_qty=5001 WHERE id=$1`, [own.lot]],
        [`UPDATE kitchen_stock_lots SET remaining_qty=-1 WHERE id=$1`, [own.lot]],
        [`UPDATE kitchen_stock_lots SET reversed_at=now() WHERE id=$1`, [own.lot]],
        [`UPDATE kitchen_products SET unit='кг' WHERE id=$1`, [own.product]],
        [`INSERT INTO kitchen_stock_movements(id,location_id,product_id,kind,qty,cost) VALUES(gen_random_uuid(),$1,$2,'WRITE_OFF',0,0)`, [own.loc, own.product]],
      ] as const)
        await savepoint(async () => {
          await expect(db.query(sql, [...args])).rejects.toThrow(/check constraint/);
        });
    }));

  it('охраняемый откат: с данными отказывает, на пустых таблицах убирает их', async () =>
    rollback(async () => {
      const down = readFileSync(resolve(process.cwd(), 'packages/database/prisma/migrations/20261012000089_kitchen_stock/down.sql'), 'utf8');
      const downBeautyMaterials = readFileSync(
        resolve(process.cwd(), 'packages/database/prisma/migrations/20261018000135_beauty_materials/down.sql'),
        'utf8',
      ).replace(/^BEGIN;\s*/, '').replace(/\s*COMMIT;\s*$/, '');
      await seed();
      await savepoint(async () => {
        await expect(db.query(down)).rejects.toThrow(/Kitchen stock data present/);
      });
      await db.query(`SELECT set_config('wetop.audit_purge','on',true)`);
      await db.query('DELETE FROM kitchen_stock_movements');
      // §38: строки техкарт ссылаются на ингредиенты (в общей схеме могут лежать с других прогонов)
      await db.query('UPDATE menu_item_ingredients SET product_id = NULL WHERE product_id IS NOT NULL');
      await db.query('DELETE FROM beauty_service_materials');
      await db.query('DELETE FROM beauty_service_material_revisions');
      await db.query('DELETE FROM kitchen_stock_lots');
      await db.query('DELETE FROM kitchen_products');
      // Откат идёт в обратном порядке: Beauty materials, затем §38, затем сам склад.
      const downConsumption = readFileSync(
        resolve(process.cwd(), 'packages/database/prisma/migrations/20261012000093_kitchen_consumption/down.sql'),
        'utf8',
      );
      await savepoint(async () => {
        await db.query(downBeautyMaterials);
        await db.query(downConsumption);
        await db.query(down);
        for (const table of tables)
          expect((await db.query(`SELECT 1 FROM pg_tables WHERE schemaname=$1 AND tablename=$2`, [schema(), table])).rowCount).toBe(0);
      });
    }));
});
