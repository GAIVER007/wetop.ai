import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isLocalDatabase } from '../tools/seed-local';
import { barProofFixture } from '../tools/bar-proof-fixture';

/** Committed synthetic data in a disposable schema allow real concurrent sessions, never public/dev data. */
describe('BAR parent mutation races preserve ownership', () => {
  const schema = `bar_race_${randomUUID().replaceAll('-', '')}`;
  let observer: pg.Client, parent: pg.Client, link: pg.Client;
  let proof: ReturnType<typeof barProofFixture>;
  let parentPid: number, linkPid: number;
  beforeAll(async () => {
    const url = process.env.DATABASE_URL;
    if (!url || !isLocalDatabase(url))
      throw new Error('Concurrency proof requires isolated localhost PostgreSQL');
    observer = new pg.Client({ connectionString: url });
    await observer.connect();
    await observer.query(`CREATE SCHEMA ${schema}`);
    await observer.query(`SET search_path TO ${schema}, public`);
    const dir = resolve(import.meta.dirname, '../../packages/database/prisma/migrations');
    for (const name of readdirSync(dir).sort()) {
      const path = resolve(dir, name, 'migration.sql');
      if (!existsSync(path)) continue;
      await observer.query('BEGIN');
      try {
        await observer.query(readFileSync(path, 'utf8'));
        await observer.query('COMMIT');
      } catch (error) {
        await observer.query('ROLLBACK');
        throw error;
      }
    }
    proof = barProofFixture(observer);
    parent = new pg.Client({ connectionString: url, options: `-c search_path=${schema},public` });
    link = new pg.Client({ connectionString: url, options: `-c search_path=${schema},public` });
    await parent.connect();
    await link.connect();
    parentPid = (await parent.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    linkPid = (await link.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  });
  afterAll(async () => {
    await parent?.end();
    await link?.end();
    if (observer) {
      await observer.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await observer.end();
    }
  });
  async function begin(client: pg.Client, role: string, org: string, isolation = 'READ COMMITTED') {
    await client.query(`BEGIN ISOLATION LEVEL ${isolation}`);
    await client.query(`SET LOCAL ROLE ${role}`);
    await client.query("SELECT set_config('app.org_id',$1,true)", [org]);
  }
  async function blocked(pid: number) {
    for (let i = 0; i < 100; i++) {
      const row = (
        await observer.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1', [pid])
      ).rows[0];
      if (row?.wait_event_type === 'Lock') return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('Expected a real parent/link row lock wait');
  }
  for (const [parentIsolation, linkIsolation] of [
    ['READ COMMITTED', 'READ COMMITTED'],
    ['REPEATABLE READ', 'READ COMMITTED'],
    ['READ COMMITTED', 'REPEATABLE READ'],
    ['REPEATABLE READ', 'REPEATABLE READ'],
  ])
    for (const role of ['wetop_app', 'wetop_service'])
      for (const kind of ['payment cash', 'sale cash', 'charge', 'folio', 'item', 'reservation'])
        for (const operation of ['create', 'relink'])
          for (const order of ['parent-first', 'link-first']) {
            it(`${role}: ${kind}, ${operation}, ${order}, parent ${parentIsolation}, link ${linkIsolation}`, async () => {
              const a = await proof.side('concurrent');
              const own = (
                await observer.query(
                  'SELECT i.* FROM reservation_items i JOIN folios f ON f.reservation_item_id=i.id WHERE f.id=$1',
                  [a.folios[0]],
                )
              ).rows[0];
              const reservation = (
                await observer.query('SELECT * FROM reservations WHERE id=$1', [own.reservation_id])
              ).rows[0];
              const foreignReservation = randomUUID(),
                foreignItem = randomUUID();
              await proof.insert('reservations', {
                ...reservation,
                id: foreignReservation,
                confirmation_number: foreignReservation,
                property_id: a.secondProperty,
              });
              await proof.insert('reservation_items', {
                ...own,
                id: foreignItem,
                reservation_id: foreignReservation,
              });
              const mutation: Record<string, [string, unknown[]]> = {
                'payment cash': [
                  'UPDATE cash_operations SET property_id=$1 WHERE id=$2',
                  [a.secondProperty, a.unusedCash],
                ],
                'sale cash': [
                  'UPDATE cash_operations SET property_id=$1 WHERE id=$2',
                  [a.secondProperty, a.unusedCash],
                ],
                charge: ['UPDATE charges SET folio_id=$1 WHERE id=$2', [a.folios[1], a.charges[0]]],
                folio: [
                  'UPDATE folios SET reservation_item_id=$1 WHERE id=$2',
                  [foreignItem, a.folios[0]],
                ],
                item: [
                  'UPDATE reservation_items SET reservation_id=$1 WHERE id=$2',
                  [foreignReservation, own.id],
                ],
                reservation: [
                  'UPDATE reservations SET property_id=$1 WHERE id=$2',
                  [a.secondProperty, own.reservation_id],
                ],
              };
              const payment = kind === 'payment cash';
              const table = payment ? 'bar_supplier_payments' : 'bar_sales';
              const existing = payment ? a.rows.bar_supplier_payments : a.rows.bar_sales;
              const data = (await observer.query(`SELECT * FROM ${table} WHERE id=$1`, [existing]))
                .rows[0];
              const changes = payment
                ? { cash_operation_id: a.unusedCash }
                : {
                    cash_operation_id: kind === 'sale cash' ? a.unusedCash : null,
                    folio_id: ['charge', 'folio', 'item', 'reservation'].includes(kind)
                      ? a.folios[0]
                      : null,
                    charge_id: kind === 'charge' ? a.charges[0] : null,
                  };
              const inserted = {
                ...data,
                ...changes,
                id: randomUUID(),
                ...(payment ? { receipt_id: a.spare.receipt } : { idempotency_key: randomUUID() }),
              };
              const cols = Object.keys(operation === 'create' ? inserted : changes);
              const sql =
                operation === 'create'
                  ? `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')})`
                  : `UPDATE ${table} SET ${cols.map((c, i) => `${c}=$${i + 1}`).join(',')} WHERE id=$${cols.length + 1}`;
              const params =
                operation === 'create'
                  ? Object.values(inserted)
                  : [...Object.values(changes), existing];
              const [moveSql, moveParams] = mutation[kind]!;
              await begin(parent, role, a.org, parentIsolation);
              await begin(link, role, a.org, linkIsolation);
              const first = order === 'parent-first' ? parent : link,
                second = order === 'parent-first' ? link : parent;
              let pending: Promise<Error | null> | undefined;
              try {
                await first.query(
                  order === 'parent-first' ? moveSql : sql,
                  order === 'parent-first' ? moveParams : params,
                );
                pending = second
                  .query(
                    order === 'parent-first' ? sql : moveSql,
                    order === 'parent-first' ? params : moveParams,
                  )
                  .then(
                    () => null,
                    (error) => error as Error,
                  );
                await blocked(order === 'parent-first' ? linkPid : parentPid);
                await first.query('COMMIT');
                const error = await pending;
                expect(
                  error,
                  'waiting transaction must reject inconsistent ownership',
                ).toBeInstanceOf(Error);
                if (
                  (order === 'parent-first' ? linkIsolation : parentIsolation) === 'REPEATABLE READ'
                )
                  expect(error).toMatchObject({ code: '40001' });
                else expect(error!.message).toMatch(/BAR .*ownership/);
                await second.query('ROLLBACK');
                const violations = (
                  await observer.query(`
                SELECT 1 FROM bar_sales s JOIN cash_operations c ON c.id=s.cash_operation_id WHERE s.property_id<>c.property_id
                UNION ALL SELECT 1 FROM bar_supplier_payments p JOIN bar_receipts r ON r.id=p.receipt_id JOIN cash_operations c ON c.id=p.cash_operation_id WHERE r.property_id<>c.property_id
                UNION ALL SELECT 1 FROM bar_sales s JOIN folios f ON f.id=s.folio_id JOIN reservation_items i ON i.id=f.reservation_item_id JOIN reservations r ON r.id=i.reservation_id WHERE s.property_id<>r.property_id
                UNION ALL SELECT 1 FROM bar_sales s JOIN charges c ON c.id=s.charge_id JOIN folios f ON f.id=c.folio_id JOIN reservation_items i ON i.id=f.reservation_item_id JOIN reservations r ON r.id=i.reservation_id WHERE s.property_id<>r.property_id OR (s.folio_id IS NOT NULL AND s.folio_id<>c.folio_id)`)
                ).rowCount;
                expect(violations).toBe(0);
              } finally {
                await first.query('ROLLBACK');
                if (pending) await pending;
                await second.query('ROLLBACK');
              }
            });
          }
  for (const role of ['wetop_app', 'wetop_service']) {
    it(`${role}: stale repeatable-read parent snapshot cannot miss a committed BAR link`, async () => {
      const a = await proof.side('repeatable-read');
      await parent.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
      await parent.query(`SET LOCAL ROLE ${role}`);
      await parent.query("SELECT set_config('app.org_id',$1,true)", [a.org]);
      await parent.query('SELECT id FROM cash_operations WHERE id=$1', [a.unusedCash]);
      try {
        await begin(link, role, a.org);
        await link.query('UPDATE bar_sales SET cash_operation_id=$1 WHERE id=$2', [
          a.unusedCash,
          a.rows.bar_sales,
        ]);
        await link.query('COMMIT');
        await expect(
          parent.query('UPDATE cash_operations SET property_id=$1 WHERE id=$2', [
            a.secondProperty,
            a.unusedCash,
          ]),
        ).rejects.toMatchObject({ code: '40001' });
      } finally {
        await parent.query('ROLLBACK');
        await link.query('ROLLBACK');
      }
    });
  }
  for (const role of ['wetop_app', 'wetop_service'])
    for (const kind of ['charge', 'folio', 'item']) {
      it(`${role}: stale ancestor snapshot cannot miss a valid ${kind} reparent`, async () => {
        const a = await proof.side('ancestor-snapshot');
        await observer.query('UPDATE bar_sales SET folio_id=$1,charge_id=$2 WHERE id=$3', [
          kind === 'charge' ? null : a.folios[0],
          kind === 'charge' ? a.charges[0] : null,
          a.rows.bar_sales,
        ]);
        const oldItem = (
          await observer.query(
            'SELECT i.* FROM reservation_items i JOIN folios f ON f.reservation_item_id=i.id WHERE f.id=$1',
            [a.folios[0]],
          )
        ).rows[0]!;
        const nextItem = (
          await observer.query(
            'SELECT i.* FROM reservation_items i JOIN folios f ON f.reservation_item_id=i.id WHERE f.id=$1',
            [a.folios[1]],
          )
        ).rows[0]!;
        const unusedItem = randomUUID();
        await proof.insert('reservation_items', { ...nextItem, id: unusedItem });
        await parent.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
        await parent.query(`SET LOCAL ROLE ${role}`);
        await parent.query("SELECT set_config('app.org_id',$1,true)", [a.org]);
        await parent.query('SELECT id FROM reservations WHERE id=$1', [nextItem.reservation_id]);
        try {
          await begin(link, role, a.org);
          const updates: Record<string, [string, unknown[]]> = {
            charge: ['UPDATE charges SET folio_id=$1 WHERE id=$2', [a.folios[1], a.charges[0]]],
            folio: [
              'UPDATE folios SET reservation_item_id=$1 WHERE id=$2',
              [unusedItem, a.folios[0]],
            ],
            item: [
              'UPDATE reservation_items SET reservation_id=$1 WHERE id=$2',
              [nextItem.reservation_id, oldItem.id],
            ],
          };
          const [sql, args] = updates[kind]!;
          expect((await link.query(sql, args)).rowCount).toBe(1);
          await link.query('COMMIT');
          await expect(
            parent.query('UPDATE reservations SET property_id=$1 WHERE id=$2', [
              a.secondProperty,
              nextItem.reservation_id,
            ]),
          ).rejects.toMatchObject({ code: '40001' });
        } finally {
          await parent.query('ROLLBACK');
          await link.query('ROLLBACK');
        }
      });
    }
});
