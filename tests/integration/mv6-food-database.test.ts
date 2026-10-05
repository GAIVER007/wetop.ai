import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isLocalDatabase } from '../tools/seed-local';
const url = process.env.DATABASE_URL;
const tables = [
  'dining_areas',
  'dining_tables',
  'service_periods',
  'restaurant_reservations',
  'table_assignments',
] as const;
describe.skipIf(!url)('MV6 populated RLS and database constraints', () => {
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
  async function seed() {
    const ids = {
      org: randomUUID(),
      biz: randomUUID(),
      loc: randomUUID(),
      area: randomUUID(),
      table: randomUUID(),
      period: randomUUID(),
      customer: randomUUID(),
      reservation: randomUUID(),
    };
    await db.query(`INSERT INTO organizations(id,name) VALUES($1,'MV6 RLS synthetic')`, [ids.org]);
    await db.query(
      `INSERT INTO businesses(id,organization_id,name,vertical,updated_at) VALUES($1,$2,'MV6 synthetic','FOOD_SERVICE',now())`,
      [ids.biz, ids.org],
    );
    await db.query(
      `INSERT INTO locations(id,business_id,name,timezone,currency,updated_at) VALUES($1,$2,'MV6 synthetic','Asia/Almaty','KZT',now())`,
      [ids.loc, ids.biz],
    );
    await db.query(
      `INSERT INTO customers(id,organization_id,first_name,updated_at) VALUES($1,$2,'Synthetic',now())`,
      [ids.customer, ids.org],
    );
    await db.query(
      `INSERT INTO dining_areas(id,location_id,name,updated_at) VALUES($1,$2,'Main',now())`,
      [ids.area, ids.loc],
    );
    await db.query(
      `INSERT INTO dining_tables(id,area_id,name,capacity,updated_at) VALUES($1,$2,'A',4,now())`,
      [ids.table, ids.area],
    );
    await db.query(
      `INSERT INTO service_periods(id,location_id,name,weekday,time_from,time_to,default_duration_minutes,updated_at) VALUES($1,$2,'Dinner',1,'18:00','22:00',60,now())`,
      [ids.period, ids.loc],
    );
    await db.query(
      `INSERT INTO restaurant_reservations(id,location_id,customer_id,service_period_id,starts_at,ends_at,party_size,creation_key,creation_fingerprint,updated_at) VALUES($1,$2,$3,$4,'2026-10-12T13:00Z','2026-10-12T14:00Z',2,'seed',repeat('a',64),now())`,
      [ids.reservation, ids.loc, ids.customer, ids.period],
    );
    await db.query(
      `INSERT INTO table_assignments(reservation_id,table_id,updated_at) VALUES($1,$2,now())`,
      [ids.reservation, ids.table],
    );
    return ids;
  }
  it('all five populated tables: own rows writable; foreign and absent tenant invisible; service sees both', async () =>
    rollback(async () => {
      const own = await seed(),
        other = await seed();
      const keys = [own.area, own.table, own.period, own.reservation, own.reservation];
      const foreign = [other.area, other.table, other.period, other.reservation, other.reservation];
      for (const [i, table] of tables.entries()) {
        const column = table === 'table_assignments' ? 'reservation_id' : 'id';
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
            if (tenant !== own.org)
              expect(
                (await db.query(`DELETE FROM ${table} WHERE ${column}=$1`, [keys[i]])).rowCount,
              ).toBe(0);
          });
        await savepoint(async () => {
          await db.query('SET LOCAL ROLE wetop_service');
          expect(
            (
              await db.query(`SELECT ${column} FROM ${table} WHERE ${column}=ANY($1::uuid[])`, [
                [keys[i], foreign[i]],
              ])
            ).rowCount,
          ).toBe(2);
        });
      }
      const inserts: [string, unknown[]][] = [
        [
          `INSERT INTO dining_areas(id,location_id,name,updated_at) VALUES($1,$2,'Denied',now())`,
          [randomUUID(), other.loc],
        ],
        [
          `INSERT INTO dining_tables(id,area_id,name,capacity,updated_at) VALUES($1,$2,'Denied',2,now())`,
          [randomUUID(), other.area],
        ],
        [
          `INSERT INTO service_periods(id,location_id,name,weekday,time_from,time_to,default_duration_minutes,updated_at) VALUES($1,$2,'Denied',1,'18:00','22:00',60,now())`,
          [randomUUID(), other.loc],
        ],
        [
          `INSERT INTO restaurant_reservations(id,location_id,customer_id,service_period_id,starts_at,ends_at,party_size,creation_key,creation_fingerprint,updated_at) VALUES($1,$2,$3,$4,'2026-10-12T13:00Z','2026-10-12T14:00Z',2,'denied',repeat('a',64),now())`,
          [randomUUID(), other.loc, other.customer, other.period],
        ],
        [
          `INSERT INTO table_assignments(reservation_id,table_id,updated_at) VALUES($1,$2,now())`,
          [other.reservation, other.table],
        ],
      ];
      for (const [sql, args] of inserts)
        for (const tenant of [own.org, ''])
          await savepoint(async () => {
            await db.query('SET LOCAL ROLE wetop_app');
            await db.query(`SELECT set_config('app.org_id',$1,true)`, [tenant]);
            await expect(db.query(sql, args)).rejects.toMatchObject({
              code: expect.stringMatching(/^(42501|P0001)$/),
            });
          });
    }));
  it('database guards reject cross-location, cross-organization, invalid values and missing seated assignment', async () =>
    rollback(async () => {
      const a = await seed(),
        b = await seed();
      const rejected: [string, unknown[], string][] = [
        [
          'UPDATE restaurant_reservations SET service_period_id=$1 WHERE id=$2',
          [b.period, a.reservation],
          'Food period belongs to another location',
        ],
        [
          'UPDATE restaurant_reservations SET customer_id=$1 WHERE id=$2',
          [b.customer, a.reservation],
          'Food customer belongs to another organization',
        ],
        [
          'UPDATE table_assignments SET table_id=$1 WHERE reservation_id=$2',
          [b.table, a.reservation],
          'Food table belongs to another location',
        ],
        [
          'UPDATE dining_tables SET area_id=$1 WHERE id=$2',
          [b.area, a.table],
          'Food parent is immutable',
        ],
        ['UPDATE dining_tables SET capacity=0 WHERE id=$1', [a.table], 'dining_tables_values'],
        ['UPDATE service_periods SET weekday=7 WHERE id=$1', [a.period], 'service_periods_values'],
        [
          'UPDATE restaurant_reservations SET party_size=0 WHERE id=$1',
          [a.reservation],
          'restaurant_reservations_values',
        ],
        [
          'UPDATE restaurant_reservations SET ends_at=starts_at WHERE id=$1',
          [a.reservation],
          'restaurant_reservations_values',
        ],
      ];
      for (const [sql, args, message] of rejected)
        await savepoint(async () => {
          await expect(db.query(sql, args)).rejects.toThrow(message);
        });
      await savepoint(async () => {
        await db.query(`UPDATE businesses SET vertical='BEAUTY' WHERE id=$1`, [a.biz]);
        await expect(
          db.query(`UPDATE dining_areas SET name='Denied' WHERE id=$1`, [a.area]),
        ).rejects.toThrow('Food location required');
      });
      await savepoint(async () => {
        await db.query(`UPDATE restaurant_reservations SET status='SEATED' WHERE id=$1`, [
          a.reservation,
        ]);
        await db.query('DELETE FROM table_assignments WHERE reservation_id=$1', [a.reservation]);
        await expect(db.query('SET CONSTRAINTS ALL IMMEDIATE')).rejects.toThrow(
          'Seated reservation requires a table',
        );
      });
    }));
  it('assignment cannot be moved to another reservation leaving SEATED without a table', async () =>
    rollback(async () => {
      const a = await seed(),
        newId = randomUUID();
      await db.query(`UPDATE restaurant_reservations SET status='SEATED' WHERE id=$1`, [
        a.reservation,
      ]);
      await db.query(
        `INSERT INTO restaurant_reservations(id,location_id,customer_id,service_period_id,starts_at,ends_at,party_size,creation_key,creation_fingerprint,updated_at) SELECT $2,location_id,customer_id,service_period_id,starts_at,ends_at,party_size,'second',creation_fingerprint,now() FROM restaurant_reservations WHERE id=$1`,
        [a.reservation, newId],
      );
      await expect(
        db.query('UPDATE table_assignments SET reservation_id=$1 WHERE reservation_id=$2', [
          newId,
          a.reservation,
        ]),
      ).rejects.toThrow('Food parent is immutable');
    }));
  it('down refuses populated Food tables without deleting data', async () =>
    rollback(async () => {
      const a = await seed();
      await savepoint(async () => {
        const sql = readFileSync(
          new URL(
            '../../packages/database/prisma/migrations/20261005000058_food_service_domain/down.sql',
            import.meta.url,
          ),
          'utf8',
        );
        await expect(db.query(sql)).rejects.toThrow(
          'Food data present: refuse destructive rollback',
        );
      });
      expect(
        (await db.query('SELECT id FROM restaurant_reservations WHERE id=$1', [a.reservation]))
          .rowCount,
      ).toBe(1);
    }));
});
