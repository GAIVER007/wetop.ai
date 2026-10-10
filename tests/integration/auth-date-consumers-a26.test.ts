import { readFileSync } from 'node:fs';
import pg from 'pg';
import { describe, it, expect } from 'vitest';
import { createPrismaClient } from '../../packages/database/src/index';
const parent = process.env.A28_WORK_DIR ?? process.env.A26_WORK_DIR;
const databaseHost = process.env.A28_PG_HOST ?? '127.0.0.1';
const databasePort = Number(process.env.A28_PG_PORT ?? '55601');
const migratorRole = process.env.A28_PG_MIGRATOR_ROLE ?? 'a24_migrator';
const databaseName = process.env.A28_PG_DATABASE ?? 'a26_auth';
const connection = (role: string) =>
  `postgresql://${role}@${databaseHost}:${databasePort}/${databaseName}`;
describe.skipIf(!parent)('A26 real DATE and event consumers', () => {
  it('preserves receipt dates, event epochs and nullable timestamps', async () => {
    const data = JSON.parse(readFileSync(`${parent}/a26-private.json`, 'utf8')) as { org: string };
    const observer = new pg.Client({
      connectionString: connection(migratorRole),
      options: '-c search_path=pms_test,public',
    });
    await observer.connect();
    const db = createPrismaClient(connection('wetop_service'), 'pms_test', {
      of: () => data.org,
      appConnectionString: connection('wetop_app'),
    });
    try {
      const rows = (
        await observer.query(
          'SELECT r.id, r.document_date::text document_date, r.received_date::text received_date, floor(extract(epoch from r.created_at)*1000)::float8 created_epoch FROM bar_receipts r JOIN properties p ON p.id=r.property_id WHERE p.organization_id=$1',
          [data.org],
        )
      ).rows;
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        const receipt = await db.barReceipt.findUniqueOrThrow({ where: { id: row.id } });
        expect(receipt.documentDate.toISOString().slice(0, 10)).toBe(row.document_date);
        expect(receipt.receivedDate.toISOString().slice(0, 10)).toBe(row.received_date);
        expect(receipt.createdAt.getTime()).toBe(row.created_epoch);
        expect(receipt.reversedAt).toBeNull();
      }
      const session = (
        await observer.query(
          'SELECT id,floor(extract(epoch from issued_at)*1000)::float8 issued FROM sessions WHERE organization_id=$1 LIMIT 1',
          [data.org],
        )
      ).rows[0];
      const stored = await db.session.findUniqueOrThrow({ where: { id: session.id } });
      expect(stored.issuedAt.getTime()).toBe(session.issued);
      const service = createPrismaClient(connection('wetop_service'), 'pms_test');
      try {
        const stays = (
          await observer.query(
            'SELECT id,arrival_date::text arrival,departure_date::text departure FROM reservations LIMIT 3',
          )
        ).rows;
        expect(stays.length).toBeGreaterThan(0);
        for (const row of stays) {
          const stay = await service.reservation.findUniqueOrThrow({ where: { id: row.id } });
          expect(stay.arrivalDate.toISOString().slice(0, 10)).toBe(row.arrival);
          expect(stay.departureDate.toISOString().slice(0, 10)).toBe(row.departure);
        }
      } finally {
        await service.$disconnect();
      }
    } finally {
      await db.$disconnect();
      await observer.end();
    }
  });
});
