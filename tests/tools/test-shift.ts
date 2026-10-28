import { randomUUID } from 'node:crypto';
import type { Db } from '@pms/database';

/**
 * Открытая смена для интеграционных тестов (владелец 27.10.2026: без открытой смены администратор не вносит записи и
 * брони, apps/api/src/finance/shift-guard.ts). Тест, который пишет от лица администратора, открывает смену в кассе
 * своего филиала этой функцией, а в afterAll убирает её `dropTestShifts` до удаления филиала.
 */
export async function openTestShift(
  db: Db,
  input: { organizationId: string; userId: string; locationId?: string; propertyId?: string },
): Promise<void> {
  const propertyId = input.propertyId ?? null;
  const locationId = propertyId ? null : (input.locationId ?? null);
  if (!propertyId && !locationId) throw new Error('openTestShift: нужен филиал или объект');
  // кассу открывает член организации (триггер «Ответственный не состоит в организации кассы»): тестовый
  // пользователь без членства получает его здесь, роль OWNER, как у того, кто открывает смену у себя
  await db.$executeRaw`INSERT INTO memberships (user_id, organization_id, role)
    VALUES (${input.userId}::uuid, ${input.organizationId}::uuid, 'OWNER') ON CONFLICT DO NOTHING`;
  await db.$executeRaw`INSERT INTO cash_registers (id, organization_id, property_id, location_id, name, currency)
    VALUES (${randomUUID()}::uuid, ${input.organizationId}::uuid, ${propertyId}::uuid, ${locationId}::uuid, 'Тестовая касса', 'KZT')
    ON CONFLICT DO NOTHING`;
  await db.$executeRaw`INSERT INTO cash_shifts (id, register_id, responsible_user_id, opening)
    SELECT ${randomUUID()}::uuid, r.id, ${input.userId}::uuid,
           '{"counted":"0","note":"","snapshot":{"balances":{},"expenses":{},"received":{},"refunds":{},"fingerprint":"test"}}'::jsonb
      FROM cash_registers r
     WHERE (r.property_id = ${propertyId}::uuid OR r.location_id = ${locationId}::uuid)
       AND NOT EXISTS (SELECT 1 FROM cash_shifts s WHERE s.register_id = r.id AND s.closed_at IS NULL)`;
}

/** Убрать тестовые кассы и смены филиалов (или объектов) до удаления самих филиалов */
export async function dropTestShifts(db: Db, scope: { locationIds?: string[]; propertyIds?: string[] }): Promise<void> {
  const locations = scope.locationIds ?? [];
  const properties = scope.propertyIds ?? [];
  const registers = await db.$queryRaw<Array<{ id: string }>>`SELECT id FROM cash_registers
    WHERE location_id = ANY(${locations}::uuid[]) OR property_id = ANY(${properties}::uuid[])`;
  const ids = registers.map((r) => r.id);
  if (!ids.length) return;
  await db.$executeRaw`DELETE FROM cash_commands WHERE register_id = ANY(${ids}::uuid[])`;
  await db.$executeRaw`DELETE FROM cash_handovers WHERE register_id = ANY(${ids}::uuid[])`;
  await db.$executeRaw`UPDATE cash_operations SET cash_shift_id = NULL
    WHERE cash_shift_id IN (SELECT id FROM cash_shifts WHERE register_id = ANY(${ids}::uuid[]))`;
  await db.$executeRaw`UPDATE restaurant_cash_operations SET cash_shift_id = NULL
    WHERE cash_shift_id IN (SELECT id FROM cash_shifts WHERE register_id = ANY(${ids}::uuid[]))`;
  await db.$executeRaw`DELETE FROM cash_shifts WHERE register_id = ANY(${ids}::uuid[])`;
  await db.$executeRaw`DELETE FROM cash_registers WHERE id = ANY(${ids}::uuid[])`;
}
