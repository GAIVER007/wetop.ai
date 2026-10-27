import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import type { DbTx } from '@pms/database';
import { currentRole, currentUserId } from '../auth/request-context';

/**
 * Без открытой смены администратор не вносит записи и брони (владелец 27.10.2026: «пока смена не открыта нельзя
 * вносить брони и т.д.»). Правило сервера, а не только кнопки: обойти его из браузера нельзя.
 *
 * - Кого держит: вошедших администраторов и мастеров (роль STAFF и «Личный кабинет»). Владелец и управляющий
 *   правят и без смены (поправить из дома, разобрать вчерашнее).
 * - Кого не держит: онлайн-запись клиентов с сайта и каналы (нет вошедшего человека): клиент записывается и ночью.
 * - Смена ищется по кассе филиала: у гостиницы по объекту, у салона и ресторана по филиалу.
 */
export const SHIFT_REQUIRED_MESSAGE =
  'Смена не открыта. Откройте смену кнопкой «Открыть смену» вверху экрана, затем повторите.';

export function shiftRequired(role: string | null, userId: string | null): boolean {
  if (!userId) return false;
  return role === 'STAFF' || role === 'EMPLOYEE';
}

export async function hasOpenShift(
  db: DbTx,
  where: { propertyId: string | null; locationId: string | null },
): Promise<boolean> {
  const rows = await db.$queryRaw<Array<{ open: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM cash_shifts s JOIN cash_registers r ON r.id = s.register_id
       WHERE s.closed_at IS NULL
         AND (r.property_id = ${where.propertyId}::uuid OR r.location_id = ${where.locationId}::uuid)
    ) AS open`;
  return rows[0]?.open === true;
}

/** Бросает 409 с понятным текстом, если вошедшему нужна смена, а она в кассе филиала не открыта */
export async function assertShiftOpen(
  db: DbTx,
  where: { propertyId: string | null; locationId: string | null },
): Promise<void> {
  if (!shiftRequired(currentRole(), currentUserId())) return;
  if (await hasOpenShift(db, where)) return;
  throw new ConflictException(SHIFT_REQUIRED_MESSAGE);
}
