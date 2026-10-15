// Безопасный вывод из использования тестовых записей QA (ТЗ 01.10.2026, §10): место, категория, тариф.
// Только по явным идентификаторам, по умолчанию dry-run (ROLLBACK), запись только с --apply.
// Ничего не удаляет: ставит active=false через существующие поля, кладёт в журнал образ «до».
// Брони, гости, счета, цены, блокировки и уборка не трогаются; бронь 20261001-8PDHSK скрипт не читает.
//
//   DATABASE_POOL_MAX=1 node scripts/ops/retire-test-entities.mjs \
//     --unit YUNGA-TEST-20261001 --category category-74665316-234f-4968-aeec-685bcefa71d4 \
//     --rate-plan rate-8593e4c8 [--apply]
//
// Каждая запись проверяется отдельно и целиком отклоняется, если её что-то держит:
//   место:     есть размещения (allocations) или уже выключено;
//   категория: брони (reservation_items), тарифы (rate_plan_accommodation_types), сопоставления каналов,
//              действующие места кроме названного здесь, или уже выключена;
//   тариф:     брони, сопоставления каналов, сайт (tracked_sites), действующие производные, или уже выключен.
import { Client } from 'pg';
import process from 'node:process';
import console from 'node:console';
import { randomUUID } from 'node:crypto';

function args() {
  const out = { apply: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--apply') out.apply = true;
    else if (a === '--unit' || a === '--category' || a === '--rate-plan') out[a.slice(2)] = argv[++i];
    else throw new Error(`Неизвестный аргумент: ${a}`);
  }
  if (!out.unit && !out.category && !out['rate-plan'])
    throw new Error('Укажите хотя бы одно: --unit <код>, --category <uuid>, --rate-plan <код>');
  return out;
}

const one = (rows, what) => {
  if (rows.length !== 1) throw new Error(`${what}: найдено ${rows.length}, нужна ровно одна запись; ничего не меняем`);
  return rows[0];
};

async function main() {
  const opts = args();
  const db = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  await db.connect();
  const result = { dryRun: !opts.apply, unit: null, category: null, ratePlan: null };
  try {
    await db.query('BEGIN');
    const audit = async (entityType, row, note) => {
      await db.query(
        `INSERT INTO audit_logs (id, entity_type, entity_id, action, before, after, organization_id)
         VALUES ($1::uuid, $2, $3, 'qa.retireTestEntity', $4::jsonb, $5::jsonb, $6::uuid)`,
        [randomUUID(), entityType, row.id, JSON.stringify(row), JSON.stringify({ active: false, note }), row.organization_id],
      );
    };
    const note = 'ТЗ QA 01.10.2026 §10: тестовая запись выведена из использования';

    if (opts.unit) {
      const unit = one(
        (
          await db.query(
            `SELECT u.*, p.organization_id,
                    (SELECT COUNT(*) FROM allocations a WHERE a.inventory_unit_id = u.id)::int AS allocations
             FROM inventory_units u JOIN properties p ON p.id = u.property_id
             WHERE u.code = $1 FOR UPDATE OF u`,
            [opts.unit],
          )
        ).rows,
        `место ${opts.unit}`,
      );
      if (!unit.active) throw new Error(`место ${opts.unit} уже выключено`);
      if (unit.allocations > 0) throw new Error(`место ${opts.unit} держат размещения: ${unit.allocations}; ничего не меняем`);
      await db.query('UPDATE inventory_units SET active = false, updated_at = now() WHERE id = $1::uuid', [unit.id]);
      await audit('InventoryUnit', unit, note);
      result.unit = { id: unit.id, code: unit.code, retired: true };
    }

    if (opts.category) {
      const id = String(opts.category).replace(/^category-/, '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('--category: нужен UUID категории');
      const cat = one(
        (
          await db.query(
            `SELECT t.*, p.organization_id,
                    (SELECT COUNT(*) FROM reservation_items i WHERE i.accommodation_type_id = t.id)::int AS reservations,
                    (SELECT COUNT(*) FROM rate_plan_accommodation_types l WHERE l.accommodation_type_id = t.id)::int AS rate_plans,
                    (SELECT COUNT(*) FROM channel_mappings m WHERE m.local_accommodation_type_id = t.id)::int AS mappings,
                    (SELECT COUNT(*) FROM inventory_units u WHERE u.accommodation_type_id = t.id AND u.active)::int AS active_units
             FROM accommodation_types t JOIN properties p ON p.id = t.property_id
             WHERE t.id = $1::uuid FOR UPDATE OF t`,
            [id],
          )
        ).rows,
        `категория ${id}`,
      );
      if (!cat.active) throw new Error(`категория ${cat.name} уже выключена`);
      const holds = [];
      if (cat.reservations > 0) holds.push(`брони: ${cat.reservations}`);
      if (cat.rate_plans > 0) holds.push(`тарифы: ${cat.rate_plans}`);
      if (cat.mappings > 0) holds.push(`сопоставления каналов: ${cat.mappings}`);
      if (cat.active_units > 0) holds.push(`действующие места: ${cat.active_units} (сначала --unit)`);
      if (holds.length) throw new Error(`категорию ${cat.name} держат ${holds.join(', ')}; ничего не меняем`);
      await db.query('UPDATE accommodation_types SET active = false, updated_at = now() WHERE id = $1::uuid', [cat.id]);
      await audit('AccommodationType', cat, note);
      result.category = { id: cat.id, name: cat.name, retired: true };
    }

    if (opts['rate-plan']) {
      const plan = one(
        (
          await db.query(
            `SELECT r.*, p.organization_id,
                    (SELECT COUNT(*) FROM reservation_items i WHERE i.rate_plan_id = r.id)::int AS reservations,
                    (SELECT COUNT(*) FROM channel_mappings m WHERE m.local_rate_plan_id = r.id)::int AS mappings,
                    (SELECT COUNT(*) FROM tracked_sites s WHERE s.booking_rate_plan_id = r.id)::int AS sites,
                    (SELECT COUNT(*) FROM rate_plans d WHERE d.parent_rate_plan_id = r.id AND d.active)::int AS derived
             FROM rate_plans r JOIN properties p ON p.id = r.property_id
             WHERE r.code = $1 FOR UPDATE OF r`,
            [opts['rate-plan']],
          )
        ).rows,
        `тариф ${opts['rate-plan']}`,
      );
      if (!plan.active) throw new Error(`тариф ${plan.name} уже выключен`);
      const holds = [];
      if (plan.reservations > 0) holds.push(`брони: ${plan.reservations}`);
      if (plan.mappings > 0) holds.push(`сопоставления каналов: ${plan.mappings}`);
      if (plan.sites > 0) holds.push(`сайт: ${plan.sites}`);
      if (plan.derived > 0) holds.push(`действующие производные: ${plan.derived}`);
      if (holds.length) throw new Error(`тариф ${plan.name} держат ${holds.join(', ')}; ничего не меняем`);
      await db.query('UPDATE rate_plans SET active = false, updated_at = now() WHERE id = $1::uuid', [plan.id]);
      await audit('RatePlan', plan, note);
      result.ratePlan = { id: plan.id, code: plan.code, name: plan.name, retired: true };
    }

    await db.query(opts.apply ? 'COMMIT' : 'ROLLBACK');
    console.log(JSON.stringify(result));
  } catch (e) {
    await db.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    await db.end();
  }
}
main().catch((e) => {
  console.error(e.code ? `${e.code}: ${e.message}` : e.message);
  process.exitCode = 1;
});
