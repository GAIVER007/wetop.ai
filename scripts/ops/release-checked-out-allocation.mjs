// Targeted repair for an allocation left by a same-day checkout. Dry run by default.
// No guest, price, folio, stay dates or housekeeping changes. Before image stays in audit.
import { Client } from 'pg';
import process from 'node:process';
import console from 'node:console';
import { randomUUID } from 'node:crypto';
async function main() {
  const id = process.argv[2];
  if (!/^[0-9a-f-]{36}$/i.test(id || '')) throw new Error('Allocation UUID required');
  const apply = process.argv[3] === '--apply';
  const db = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query('BEGIN');
    const { rows } = await db.query(
      `
      SELECT a.*, r.id AS reservation_id, p.organization_id
      FROM allocations a
      JOIN reservation_items i ON i.id=a.reservation_item_id
      JOIN reservations r ON r.id=i.reservation_id
      JOIN properties p ON p.id=r.property_id
      WHERE a.id=$1::uuid AND i.status='CHECKED_OUT'
        AND r.confirmation_number <> '20261001-8PDHSK'
        AND a.end_date > (now() AT TIME ZONE p.timezone)::date
        AND EXISTS (
          SELECT 1 FROM audit_logs l
          WHERE l.entity_id=r.id::text AND l.action IN ('reservation.checkOut','reservation.checkOut.withDebt')
            AND (l.created_at AT TIME ZONE p.timezone)::date=a.start_date
            AND EXISTS (SELECT 1 FROM jsonb_array_elements(l.after->'items') j
              WHERE j->>'id'=i.id::text AND j->>'status'='CHECKED_OUT')
            AND EXISTS (SELECT 1 FROM jsonb_array_elements(l.before->'items') j
              WHERE j->>'id'=i.id::text AND j->>'status'='CHECKED_IN')
        )
      FOR UPDATE OF a,i,r`,
      [id],
    );
    if (rows.length !== 1) throw new Error('Expected one eligible same-day allocation; no changes');
    const row = rows[0];
    await db.query('DELETE FROM allocations WHERE id=$1::uuid', [id]);
    await db.query(
      `INSERT INTO audit_logs (id,entity_type,entity_id,action,before,after,organization_id)
      VALUES ($1::uuid,'Reservation',$2,'reservation.repairSameDayCheckout',$3::jsonb,$4::jsonb,$5::uuid)`,
      [
        randomUUID(),
        row.reservation_id,
        JSON.stringify(row),
        JSON.stringify({
          allocationId: id,
          released: true,
          reason: 'Approved same-day checkout fix 2026-10-01',
        }),
        row.organization_id,
      ],
    );
    await db.query(apply ? 'COMMIT' : 'ROLLBACK');
    console.log(JSON.stringify({ eligible: 1, released: apply ? 1 : 0, dryRun: !apply }));
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  } finally {
    await db.end();
  }
}
main().catch((e) => {
  console.error(e.code || e.message);
  process.exitCode = 1;
});
