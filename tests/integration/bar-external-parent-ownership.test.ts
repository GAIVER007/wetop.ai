import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isLocalDatabase } from '../tools/seed-local';
import { barProofFixture } from '../tools/bar-proof-fixture';

/** Reverse ownership: changing a referenced cash/hospitality row must not corrupt a valid BAR link. */
describe('BAR linked external parents preserve existing ownership', () => {
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
  const cases = [
    'payment cash property',
    'sale cash property',
    'charge folio',
    'folio reservation item',
    'item reservation',
    'reservation property',
  ] as const;
  for (const role of ['wetop_app', 'wetop_service'] as const) {
    it.each(cases)(`${role} denies parent mutation: %s`, async (kind) => {
      await proof.fixture(async (a, b) => {
        await client.query(
          'UPDATE bar_sales SET folio_id=$1,charge_id=$2,cash_operation_id=$3 WHERE id=$4',
          [a.folios[0], a.charges[0], a.unusedCash, a.rows.bar_sales],
        );
        const own = (
          await client.query<{ item: string; reservation: string }>(
            `SELECT i.id AS item,i.reservation_id AS reservation FROM reservation_items i JOIN folios f ON f.reservation_item_id=i.id WHERE f.id=$1`,
            [a.folios[0]],
          )
        ).rows[0]!;
        const foreign = (
          await client.query(
            `SELECT i.* FROM reservation_items i JOIN folios f ON f.reservation_item_id=i.id WHERE f.id=$1`,
            [b.folios[0]],
          )
        ).rows[0] as Record<string, unknown>;
        const unusedItem = randomUUID();
        await proof.insert('reservation_items', { ...foreign, id: unusedItem });
        const queries = {
          'payment cash property': [
            'UPDATE cash_operations SET property_id=$1 WHERE id=$2',
            [a.secondProperty, a.cash],
          ],
          'sale cash property': [
            'UPDATE cash_operations SET property_id=$1 WHERE id=$2',
            [a.secondProperty, a.unusedCash],
          ],
          'charge folio': [
            'UPDATE charges SET folio_id=$1 WHERE id=$2',
            [a.folios[1], a.charges[0]],
          ],
          'folio reservation item': [
            'UPDATE folios SET reservation_item_id=$1 WHERE id=$2',
            [unusedItem, a.folios[0]],
          ],
          'item reservation': [
            'UPDATE reservation_items SET reservation_id=$1 WHERE id=$2',
            [foreign.reservation_id, own.item],
          ],
          'reservation property': [
            'UPDATE reservations SET property_id=$1 WHERE id=$2',
            [a.secondProperty, own.reservation],
          ],
        } as const;
        const [sql, params] = queries[kind];
        await proof.asRole(role, a.org, async () => {
          await expect(client.query(sql, [...params])).rejects.toThrow(
            /BAR .*ownership|row-level security/,
          );
        });
      });
    });
  }
  for (const role of ['wetop_app', 'wetop_service'] as const) {
    for (const indirect of [false, true]) {
      it(`${role}: ${indirect ? 'charge-only' : 'direct'} reservation Property mutation is denied`, async () => {
        await proof.fixture(async (a) => {
          await client.query('UPDATE bar_sales SET folio_id=$1,charge_id=$2 WHERE id=$3', [
            indirect ? null : a.folios[0],
            indirect ? a.charges[0] : null,
            a.rows.bar_sales,
          ]);
          const { reservation_id: reservation } = (
            await client.query(
              'SELECT i.reservation_id FROM reservation_items i JOIN folios f ON f.reservation_item_id=i.id WHERE f.id=$1',
              [a.folios[0]],
            )
          ).rows[0]!;
          await proof.asRole(role, a.org, async () => {
            await expect(
              client.query('UPDATE reservations SET property_id=$1 WHERE id=$2', [
                a.secondProperty,
                reservation,
              ]),
            ).rejects.toThrow(/BAR .*ownership/);
          });
        });
      });
    }
    it(`${role}: same-property mutations and unrelated parents remain mutable`, async () => {
      await proof.fixture(async (a) => {
        await client.query('UPDATE bar_sales SET charge_id=$1,cash_operation_id=$2 WHERE id=$3', [
          a.charges[0],
          a.unusedCash,
          a.rows.bar_sales,
        ]);
        const items = (
          await client.query(
            'SELECT i.* FROM reservation_items i JOIN folios f ON f.reservation_item_id=i.id WHERE f.id=ANY($1::uuid[]) ORDER BY f.id',
            [a.folios],
          )
        ).rows;
        const item = items[0]!,
          other = items[1]!;
        const unusedItem = randomUUID();
        await proof.insert('reservation_items', { ...item, id: unusedItem });
        await proof.asRole(role, a.org, async () => {
          for (const id of [a.cash, a.unusedCash])
            expect(
              (
                await client.query('UPDATE cash_operations SET property_id=$1 WHERE id=$2', [
                  a.property,
                  id,
                ])
              ).rowCount,
            ).toBe(1);
          expect(
            (
              await client.query('UPDATE charges SET folio_id=$1 WHERE id=$2', [
                a.folios[1],
                a.charges[0],
              ])
            ).rowCount,
          ).toBe(1);
          expect(
            (
              await client.query('UPDATE folios SET reservation_item_id=$1 WHERE id=$2', [
                unusedItem,
                a.folios[0],
              ])
            ).rowCount,
          ).toBe(1);
          expect(
            (
              await client.query('UPDATE reservation_items SET reservation_id=$1 WHERE id=$2', [
                other.reservation_id,
                unusedItem,
              ])
            ).rowCount,
          ).toBe(1);
          expect(
            (
              await client.query('UPDATE reservations SET property_id=$1 WHERE id=$2', [
                a.property,
                other.reservation_id,
              ])
            ).rowCount,
          ).toBe(1);
        });
      });
    });
    it(`${role}: unreferenced parents can change Property chains`, async () => {
      await proof.fixture(async (a) => {
        const own = (
          await client.query(
            'SELECT i.* FROM reservation_items i JOIN folios f ON f.reservation_item_id=i.id WHERE f.id=$1',
            [a.folios[0]],
          )
        ).rows[0]!;
        const newReservation = randomUUID(),
          unusedItem = randomUUID();
        const reservation = (
          await client.query('SELECT * FROM reservations WHERE id=$1', [own.reservation_id])
        ).rows[0]!;
        await proof.insert('reservations', {
          ...reservation,
          id: newReservation,
          confirmation_number: newReservation,
          property_id: a.secondProperty,
        });
        await proof.insert('reservation_items', {
          ...own,
          id: unusedItem,
          reservation_id: newReservation,
        });
        await proof.asRole(role, a.org, async () => {
          expect(
            (
              await client.query('UPDATE cash_operations SET property_id=$1 WHERE id=$2', [
                a.secondProperty,
                a.unusedCash,
              ])
            ).rowCount,
          ).toBe(1);
          expect(
            (
              await client.query('UPDATE charges SET folio_id=$1 WHERE id=$2', [
                a.folios[1],
                a.charges[0],
              ])
            ).rowCount,
          ).toBe(1);
          expect(
            (
              await client.query('UPDATE folios SET reservation_item_id=$1 WHERE id=$2', [
                unusedItem,
                a.folios[0],
              ])
            ).rowCount,
          ).toBe(1);
          expect(
            (
              await client.query('UPDATE reservation_items SET reservation_id=$1 WHERE id=$2', [
                newReservation,
                own.id,
              ])
            ).rowCount,
          ).toBe(1);
          expect(
            (
              await client.query('UPDATE reservations SET property_id=$1 WHERE id=$2', [
                a.secondProperty,
                reservation.id,
              ])
            ).rowCount,
          ).toBe(1);
        });
      });
    });
  }
  for (const role of ['wetop_app', 'wetop_service'] as const) {
    for (const kind of ['charge', 'folio', 'item']) {
      it(`${role}: charge-only ${kind} chain cannot move to another visible Property`, async () => {
        await proof.fixture(async (a) => {
          await client.query('UPDATE bar_sales SET charge_id=$1 WHERE id=$2', [
            a.charges[0],
            a.rows.bar_sales,
          ]);
          const own = (
            await client.query(
              'SELECT i.* FROM reservation_items i JOIN folios f ON f.reservation_item_id=i.id WHERE f.id=$1',
              [a.folios[0]],
            )
          ).rows[0]!;
          const reservation = (
            await client.query('SELECT * FROM reservations WHERE id=$1', [own.reservation_id])
          ).rows[0]!;
          const foreignReservation = randomUUID(),
            foreignItem = randomUUID(),
            foreignFolio = randomUUID();
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
          await proof.insert('folios', {
            id: foreignFolio,
            reservation_item_id: foreignItem,
            currency: 'KZT',
          });
          const queries: Record<string, [string, string[]]> = {
            charge: ['UPDATE charges SET folio_id=$1 WHERE id=$2', [foreignFolio, a.charges[0]!]],
            folio: [
              'UPDATE folios SET reservation_item_id=$1 WHERE id=$2',
              [foreignItem, a.folios[0]!],
            ],
            item: [
              'UPDATE reservation_items SET reservation_id=$1 WHERE id=$2',
              [foreignReservation, own.id],
            ],
          };
          await proof.asRole(role, a.org, async () => {
            const [sql, args] = queries[kind]!;
            await expect(client.query(sql, args)).rejects.toThrow(/BAR .*ownership/);
          });
        });
      });
    }
  }
  it('both reverse functions are invoker and have exact pinned schema paths', async () => {
    const rows = (
      await client.query(
        "SELECT p.prosecdef,p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=current_schema() AND p.proname IN ('bar_external_parent_guard','bar_external_parent_version_fence')",
      )
    ).rows;
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.prosecdef).toBe(false);
      expect(row.proconfig).toEqual([
        `search_path=${process.env.DATABASE_SCHEMA || 'public'}, public, pg_temp`,
      ]);
    }
  });
  it('migration preflight rejects existing corruption without repairing data', async () => {
    await proof.fixture(async (a) => {
      await client.query(
        'ALTER TABLE cash_operations DISABLE TRIGGER cash_operations_bar_ownership',
      );
      await client.query('UPDATE cash_operations SET property_id=$1 WHERE id=$2', [
        a.secondProperty,
        a.cash,
      ]);
      await client.query(
        'ALTER TABLE cash_operations ENABLE TRIGGER cash_operations_bar_ownership',
      );
      await client.query('SAVEPOINT preflight_probe');
      const sql = readFileSync(
        resolve(
          import.meta.dirname,
          '../../packages/database/prisma/migrations/20261005000057_bar_external_parent_guards/migration.sql',
        ),
        'utf8',
      ).split('CREATE FUNCTION')[0]!;
      await expect(client.query(sql)).rejects.toThrow(
        /Existing BAR ownership violations: reconciliation required/,
      );
      await client.query('ROLLBACK TO SAVEPOINT preflight_probe');
      expect(
        (await client.query('SELECT property_id FROM cash_operations WHERE id=$1', [a.cash]))
          .rows[0]!.property_id,
      ).toBe(a.secondProperty);
    });
  });
  it('unexpected table and operation fail closed', async () => {
    await client.query('BEGIN');
    try {
      await client.query('CREATE TEMP TABLE bar_reverse_unknown (id uuid)');
      await client.query(
        'CREATE TRIGGER guard BEFORE UPDATE ON bar_reverse_unknown FOR EACH ROW EXECUTE FUNCTION bar_external_parent_guard()',
      );
      await client.query('INSERT INTO bar_reverse_unknown VALUES ($1)', [randomUUID()]);
      await expect(client.query('UPDATE bar_reverse_unknown SET id=id')).rejects.toThrow(
        /Unsupported table\/operation/,
      );
    } finally {
      await client.query('ROLLBACK');
    }
    await proof.fixture(async (a) => {
      await client.query(
        'CREATE TRIGGER bar_invalid_operation BEFORE DELETE ON cash_operations FOR EACH ROW EXECUTE FUNCTION bar_external_parent_guard()',
      );
      await expect(
        client.query('DELETE FROM cash_operations WHERE id=$1', [a.unusedCash]),
      ).rejects.toThrow(/Unsupported table\/operation/);
    });
  });
});
