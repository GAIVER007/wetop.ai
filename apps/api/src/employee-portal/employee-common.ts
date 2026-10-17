import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { Db, DbTx } from '@pms/database';

export type EmployeeCommon = {
  id: string; name: string; phone: string | null; email: string | null;
  status: 'ACTIVE' | 'ARCHIVED'; profileRevision: string;
};
export type EmployeeCommonPatch = Partial<Pick<EmployeeCommon, 'name' | 'phone' | 'email' | 'status'>>;

export function employeeProfileRevision(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value))
    throw new BadRequestException('expectedProfileRevision required: некорректная или отсутствующая версия профиля');
  return value;
}

/** Values and microsecond source version are always projected from the same row snapshot. */
export async function readEmployeeCommon(db: Db | DbTx, businessId: string): Promise<EmployeeCommon[]> {
  return db.$queryRaw<EmployeeCommon[]>`
    SELECT id::text, name, phone, email, status::text AS status,
      to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "profileRevision"
    FROM employees WHERE business_id=${businessId}::uuid
  `;
}

/** Caller owns authorization, scope locks, audit and the surrounding transaction.
 * Never substitute a freshly read server version for the client's original version.
 */
export async function writeEmployeeCommon(tx: DbTx, businessId: string, id: string, expected: unknown, patch: EmployeeCommonPatch) {
  const source = employeeProfileRevision(expected);
  const [before] = await tx.$queryRaw<EmployeeCommon[]>`
    SELECT id::text, name, phone, email, status::text AS status,
      to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "profileRevision"
    FROM employees WHERE id=${id}::uuid AND business_id=${businessId}::uuid FOR UPDATE
  `;
  if (!before) throw new NotFoundException('Сотрудник не найден');
  if (source !== before.profileRevision)
    throw new ConflictException('Профиль изменён в другом окне. Ввод сохранён, сравните актуальные данные перед сохранением.');
  const next = { ...before, ...patch };
  const changed = (['name', 'phone', 'email', 'status'] as const).filter(key => next[key] !== before[key]);
  if (changed.length) {
    const [saved] = await tx.$queryRaw<EmployeeCommon[]>`
      UPDATE employees SET name=${next.name}, phone=${next.phone}, email=${next.email},
        status=${next.status}::"EmployeeStatus",
        updated_at=GREATEST(clock_timestamp(), updated_at + INTERVAL '1 microsecond')
      WHERE id=${id}::uuid AND business_id=${businessId}::uuid
      RETURNING id::text, name, phone, email, status::text AS status,
        to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "profileRevision"
    `;
    return { before, after: saved!, changed };
  }
  return { before, after: before, changed };
}
