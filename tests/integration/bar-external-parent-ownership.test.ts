import { randomUUID } from 'node:crypto';
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
});
