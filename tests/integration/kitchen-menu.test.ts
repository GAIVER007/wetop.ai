import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isLocalDatabase } from '../tools/seed-local';

/** Кухня FS1 (DATA_MODEL §33, ADR-KITCHEN-FS): RLS, триггеры принадлежности и охраняемый down */
const url = process.env.DATABASE_URL;
const tables = ['menu_categories', 'menu_items', 'location_menu_items'] as const;

describe.skipIf(!url)('Kitchen menu populated RLS and database constraints', () => {
  let db: pg.Client;
  beforeAll(async () => {
    if (!isLocalDatabase(url!)) throw new Error('Requires isolated localhost PostgreSQL');
    db = new pg.Client({
      connectionString: url,
      options: `-c search_path=${process.env.DATABASE_SCHEMA || 'public'},public`,
    });
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
    const ids = {
      org: randomUUID(),
      biz: randomUUID(),
      loc: randomUUID(),
      category: randomUUID(),
      item: randomUUID(),
    };
    await db.query(`INSERT INTO organizations(id,name) VALUES($1,'Kitchen RLS synthetic')`, [
      ids.org,
    ]);
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
      `INSERT INTO menu_categories(id,business_id,name,updated_at) VALUES($1,$2,'Супы',now())`,
      [ids.category, ids.biz],
    );
    await db.query(
      `INSERT INTO menu_items(id,business_id,category_id,name,price,currency,updated_at) VALUES($1,$2,$3,'Томатный суп',220000,'KZT',now())`,
      [ids.item, ids.biz, ids.category],
    );
    await db.query(
      `INSERT INTO location_menu_items(location_id,menu_item_id,available,updated_at) VALUES($1,$2,false,now())`,
      [ids.loc, ids.item],
    );
    return ids;
  }
  it('все три таблицы: свои строки видны и пишутся, чужой и пустой арендатор не видят, сервис видит всех', async () =>
    rollback(async () => {
      const own = await seed(),
        other = await seed();
      const keys = [own.category, own.item, own.item];
      const foreign = [other.category, other.item, other.item];
      for (const [i, table] of tables.entries()) {
        const column = table === 'location_menu_items' ? 'menu_item_id' : 'id';
        for (const tenant of [own.org, other.org, ''])
          await savepoint(async () => {
            await db.query('SET LOCAL ROLE wetop_app');
            await db.query(`SELECT set_config('app.org_id',$1,true)`, [tenant]);
            const result = await db.query(
              `SELECT ${column} AS id FROM ${table} WHERE ${column}=ANY($1::uuid[])`,
              [[keys[i], foreign[i]]],
            );
            expect(result.rows.map((r: { id: string }) => r.id)).toEqual(
              tenant === own.org ? [keys[i]] : tenant === other.org ? [foreign[i]] : [],
            );
            const updated = await db.query(
              `UPDATE ${table} SET updated_at=now() WHERE ${column}=$1`,
              [keys[i]],
            );
            expect(updated.rowCount).toBe(tenant === own.org ? 1 : 0);
          });
        await savepoint(async () => {
          await db.query('SET LOCAL ROLE wetop_service');
          expect(
            (
              await db.query(`SELECT ${column} AS id FROM ${table} WHERE ${column}=ANY($1::uuid[])`, [
                [keys[i], foreign[i]],
              ])
            ).rowCount,
          ).toBe(2);
        });
      }
    }));
  it('триггер принадлежности: чужая категория, чужое блюдо на филиале и смена бизнеса отклоняются', async () =>
    rollback(async () => {
      const own = await seed(),
        other = await seed();
      await savepoint(async () => {
        await expect(
          db.query(
            `INSERT INTO menu_items(id,business_id,category_id,name,price,currency,updated_at) VALUES($1,$2,$3,'Чужая категория',100,'KZT',now())`,
            [randomUUID(), own.biz, other.category],
          ),
        ).rejects.toThrow(/another business/);
      });
      await savepoint(async () => {
        await expect(
          db.query(
            `INSERT INTO location_menu_items(location_id,menu_item_id,updated_at) VALUES($1,$2,now())`,
            [own.loc, other.item],
          ),
        ).rejects.toThrow(/another business/);
      });
      for (const [table, id] of [
        ['menu_categories', own.category],
        ['menu_items', own.item],
      ] as const)
        await savepoint(async () => {
          await expect(
            db.query(`UPDATE ${table} SET business_id=$1 WHERE id=$2`, [other.biz, id]),
          ).rejects.toThrow(/immutable/);
        });
    }));
  it('меню живёт только у FOOD_SERVICE; имя блюда уникально в бизнесе; цена не ниже нуля', async () =>
    rollback(async () => {
      const own = await seed();
      const beauty = await seed('BEAUTY');
      await savepoint(async () => {
        await expect(
          db.query(`INSERT INTO menu_categories(id,business_id,name,updated_at) VALUES($1,$2,'Супы',now())`, [
            randomUUID(),
            beauty.biz,
          ]),
        ).rejects.toThrow(/Food business required/);
      });
      await savepoint(async () => {
        await expect(
          db.query(
            `INSERT INTO menu_items(id,business_id,name,price,currency,updated_at) VALUES($1,$2,'Томатный суп',100,'KZT',now())`,
            [randomUUID(), own.biz],
          ),
        ).rejects.toThrow(/menu_items_business_id_name_key/);
      });
      await savepoint(async () => {
        await expect(
          db.query(
            `INSERT INTO menu_items(id,business_id,name,price,currency,updated_at) VALUES($1,$2,'Минус',-1,'KZT',now())`,
            [randomUUID(), own.biz],
          ),
        ).rejects.toThrow(/menu_items_values/);
      });
    }));
  it('охраняемый down: с данными отказывает, пустой проходит', async () =>
    rollback(async () => {
      const down = readFileSync(
        resolve(
          process.cwd(),
          'packages/database/prisma/migrations/20261009000078_kitchen_menu/down.sql',
        ),
        'utf8',
      );
      await seed();
      await savepoint(async () => {
        await expect(db.query(down)).rejects.toThrow(/Menu data present/);
      });
      await db.query('DELETE FROM location_menu_items');
      await db.query('DELETE FROM menu_items');
      await db.query('DELETE FROM menu_categories');
      await savepoint(async () => {
        await db.query(down);
        // search_path дотягивается до public, поэтому отсутствие проверяется строго в текущей схеме
        const schema = process.env.DATABASE_SCHEMA || 'public';
        for (const table of tables)
          expect(
            (
              await db.query(`SELECT 1 FROM pg_tables WHERE schemaname=$1 AND tablename=$2`, [
                schema,
                table,
              ])
            ).rowCount,
          ).toBe(0);
      });
    }));
});
