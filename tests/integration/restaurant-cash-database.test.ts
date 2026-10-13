import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Касса ресторана в базе (DATA_MODEL §35, ADR-165, миграции 86-87): принадлежность, неизменяемость платежа
 * и операции, «аннулированное не оживает», значения, отсутствие DELETE у приложения и изоляция RLS.
 */
const url = process.env.DATABASE_URL;
describe.skipIf(!url)('restaurant cash: database guards, grants and RLS', () => {
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
      order: randomUUID(),
      employee: randomUUID(),
      payment: randomUUID(),
      op: randomUUID(),
    };
    await db.query(`INSERT INTO organizations(id,name) VALUES($1,'Cash synthetic')`, [ids.org]);
    await db.query(
      `INSERT INTO businesses(id,organization_id,name,vertical,updated_at) VALUES($1,$2,'Cash synthetic','FOOD_SERVICE',now())`,
      [ids.biz, ids.org],
    );
    await db.query(
      `INSERT INTO locations(id,business_id,name,timezone,currency,updated_at) VALUES($1,$2,'Cash synthetic','Asia/Almaty','KZT',now())`,
      [ids.loc, ids.biz],
    );
    await db.query(
      `INSERT INTO restaurant_orders(id,location_id,number,total,currency,updated_at) VALUES($1,$2,1,10000,'KZT',now())`,
      [ids.order, ids.loc],
    );
    await db.query(
      `INSERT INTO employees(id,business_id,name,updated_at) VALUES($1,$2,'Synthetic waiter',now())`,
      [ids.employee, ids.biz],
    );
    await db.query(
      `INSERT INTO restaurant_payments(id,location_id,order_id,method,amount,currency,idempotency_key) VALUES($1,$2,$3,'CASH',4000,'KZT','k1')`,
      [ids.payment, ids.loc, ids.order],
    );
    await db.query(
      `INSERT INTO restaurant_cash_operations(id,location_id,kind,method,amount,currency,employee_id,period) VALUES($1,$2,'EXPENSE','CASH',1000,'KZT',$3,'2026-10-01')`,
      [ids.op, ids.loc, ids.employee],
    );
    return ids;
  }

  it('guards reject foreign parents, edits of money and resurrection of voided rows', () =>
    rollback(async () => {
      const a = await seed(),
        b = await seed();
      const rejected: [string, unknown[], string][] = [
        [
          `INSERT INTO restaurant_payments(id,location_id,order_id,method,amount,currency,idempotency_key) VALUES(gen_random_uuid(),$1,$2,'CASH',1,'KZT','x')`,
          [a.loc, b.order],
          'Payment order belongs to another location',
        ],
        [
          `INSERT INTO restaurant_cash_operations(id,location_id,kind,method,amount,currency,employee_id,period) VALUES(gen_random_uuid(),$1,'EXPENSE','CASH',1,'KZT',$2,'2026-10-01')`,
          [a.loc, b.employee],
          'Payout employee belongs to another business',
        ],
        ['UPDATE restaurant_payments SET amount=1 WHERE id=$1', [a.payment], 'Restaurant payment is immutable'],
        ['UPDATE restaurant_cash_operations SET amount=1 WHERE id=$1', [a.op], 'Restaurant cash operation is immutable'],
        ['UPDATE restaurant_payments SET location_id=$1 WHERE id=$2', [b.loc, a.payment], 'Restaurant parent is immutable'],
        [
          `INSERT INTO restaurant_cash_operations(id,location_id,kind,method,method_to,amount,currency) VALUES(gen_random_uuid(),$1,'TRANSFER','CASH','CASH',1,'KZT')`,
          [a.loc],
          'restaurant_cash_operations_values',
        ],
        [
          `INSERT INTO restaurant_cash_operations(id,location_id,kind,method,amount,currency,employee_id,period) VALUES(gen_random_uuid(),$1,'INCOME','CASH',1,'KZT',$2,'2026-10-01')`,
          [a.loc, a.employee],
          'restaurant_cash_operations_values',
        ],
        [
          `INSERT INTO restaurant_payments(id,location_id,order_id,method,amount,currency,idempotency_key) VALUES(gen_random_uuid(),$1,$2,'CASH',0,'KZT','z')`,
          [a.loc, a.order],
          'restaurant_payments_values',
        ],
        [`UPDATE restaurant_payments SET status='VOIDED' WHERE id=$1`, [a.payment], 'restaurant_payments_values'],
      ];
      for (const [sql, args, message] of rejected)
        await savepoint(async () => {
          await expect(db.query(sql, args)).rejects.toThrow(message);
        });
      await db.query(
        `UPDATE restaurant_payments SET status='VOIDED', voided_at=now(), void_reason='Ошибка кассира' WHERE id=$1`,
        [a.payment],
      );
      await savepoint(async () => {
        await expect(
          db.query(
            `UPDATE restaurant_payments SET status='COMPLETED', voided_at=NULL, void_reason=NULL WHERE id=$1`,
            [a.payment],
          ),
        ).rejects.toThrow('Voided payment stays voided');
      });
    }));

  it('application role cannot delete money rows and sees only its organization', () =>
    rollback(async () => {
      const a = await seed(),
        b = await seed();
      await db.query('SET LOCAL ROLE wetop_app');
      await db.query(`SELECT set_config('app.org_id',$1,true)`, [a.org]);
      for (const table of ['restaurant_payments', 'restaurant_cash_operations'])
        await savepoint(async () => {
          await expect(db.query(`DELETE FROM ${table}`)).rejects.toThrow(/permission denied/);
        });
      await savepoint(async () => {
        await expect(db.query('UPDATE restaurant_cash_reconciliations SET counted=0')).rejects.toThrow(
          /permission denied/,
        );
      });
      const seen = await db.query('SELECT location_id FROM restaurant_payments');
      expect(seen.rows.map((r) => r.location_id)).toEqual([a.loc]);
      const ops = await db.query('SELECT location_id FROM restaurant_cash_operations WHERE location_id=$1', [
        b.loc,
      ]);
      expect(ops.rowCount).toBe(0);
    }));

  it('pay journal only grows: the app cannot edit or delete premiums and fines (§33.4, Q-REST-7)', () =>
    rollback(async () => {
      await db.query('SET LOCAL ROLE wetop_app');
      for (const sql of [
        'UPDATE employee_pay_adjustments SET amount_minor = amount_minor WHERE false',
        'DELETE FROM employee_pay_adjustments WHERE false',
      ])
        await savepoint(async () => {
          await expect(db.query(sql)).rejects.toThrow(/permission denied/);
        });
    }));

  it('floor layout: both coordinates or none, within the canvas, size and turn in range (§42)', () =>
    rollback(async () => {
      const a = await seed();
      const area = randomUUID(),
        table = randomUUID();
      await db.query(`INSERT INTO dining_areas(id,location_id,name,updated_at) VALUES($1,$2,'Зал',now())`, [area, a.loc]);
      await db.query(
        `INSERT INTO dining_tables(id,area_id,name,capacity,updated_at) VALUES($1,$2,'7',4,now())`,
        [table, area],
      );
      await db.query('UPDATE dining_tables SET pos_x=0, pos_y=1000, scale=200, rotation=90 WHERE id=$1', [table]);
      for (const set of ['pos_x=10, pos_y=NULL', 'pos_x=1001', 'pos_y=-1', 'scale=49', 'scale=201', 'rotation=45'])
        await savepoint(async () => {
          await expect(db.query(`UPDATE dining_tables SET ${set} WHERE id=$1`, [table])).rejects.toThrow(
            'dining_tables_layout',
          );
        });
    }));

  it('booking rules: ranges and one closed day per date (§43)', () =>
    rollback(async () => {
      const a = await seed();
      await db.query(`INSERT INTO food_booking_rules(location_id,buffer_minutes,horizon_days,max_party_size,updated_at) VALUES($1,240,730,500,now())`, [a.loc]);
      for (const set of ['buffer_minutes=241', 'buffer_minutes=-1', 'horizon_days=0', 'horizon_days=731', 'max_party_size=0', 'max_party_size=501'])
        await savepoint(async () => {
          await expect(db.query(`UPDATE food_booking_rules SET ${set} WHERE location_id=$1`, [a.loc])).rejects.toThrow(
            'food_booking_rules_values',
          );
        });
      await db.query(`INSERT INTO food_closed_days(id,location_id,day) VALUES(gen_random_uuid(),$1,'2026-12-31')`, [a.loc]);
      await savepoint(async () => {
        await expect(
          db.query(`INSERT INTO food_closed_days(id,location_id,day) VALUES(gen_random_uuid(),$1,'2026-12-31')`, [a.loc]),
        ).rejects.toThrow('food_closed_days_location_id_day_key');
      });
    }));

  it('guest rating: only a closed order, waiter snapshot must match, the app cannot edit or delete (§39)', () =>
    rollback(async () => {
      const a = await seed();
      const insert = (stars: number, waiter: string | null) =>
        db.query(`INSERT INTO restaurant_order_ratings(order_id,waiter_id,stars) VALUES($1,$2,$3)`, [a.order, waiter, stars]);
      await savepoint(async () => {
        await expect(insert(5, null)).rejects.toThrow('Rating requires a closed order');
      });
      await db.query(`UPDATE restaurant_orders SET status='CLOSED', closed_at=now(), waiter_id=$2 WHERE id=$1`, [a.order, a.employee]);
      await savepoint(async () => {
        await expect(insert(5, null)).rejects.toThrow('Rating waiter must be the order waiter');
      });
      await savepoint(async () => {
        await expect(insert(6, a.employee)).rejects.toThrow('restaurant_order_ratings_values');
      });
      await insert(4, a.employee);
      await db.query('SET LOCAL ROLE wetop_app');
      await db.query(`SELECT set_config('app.org_id',$1,true)`, [a.org]);
      for (const sql of ['UPDATE restaurant_order_ratings SET stars=5', 'DELETE FROM restaurant_order_ratings'])
        await savepoint(async () => {
          await expect(db.query(sql)).rejects.toThrow(/permission denied/);
        });
    }));
});
