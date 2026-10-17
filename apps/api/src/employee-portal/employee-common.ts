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

/** Atomic employee source + weekly rows, including a source for an empty week.
 * One SQL statement prevents pairing old displayed rows with a newer writer token.
 */
export async function readEmployeeWeekSource(db: Pick<DbTx, '$queryRaw'>, id: string, locationId: string) {
  const values = await db.$queryRaw<Array<{
    sourceRevision: string; id: string | null; weekday: number | null;
    timeFrom: Date | null; timeTo: Date | null;
  }>>`
    SELECT to_char(e.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "sourceRevision",
      h.id::text, h.weekday, h.time_from AS "timeFrom", h.time_to AS "timeTo"
    FROM employees e LEFT JOIN working_hours h
      ON h.employee_id=e.id AND h.location_id=${locationId}::uuid
    WHERE e.id=${id}::uuid
    ORDER BY h.weekday, h.time_from, h.id
  `;
  if (!values[0]) throw new NotFoundException('Сотрудник не найден');
  return { sourceRevision: values[0].sourceRevision, rows: values.flatMap(r => r.id === null ? [] : [{
    id: r.id, weekday: r.weekday!, timeFrom: r.timeFrom!, timeTo: r.timeTo!,
  }]) };
}

/** Caller holds employee FOR UPDATE in the surrounding authorized transaction.
 * Every weekly save advances, even empty -> empty. Also invalidates profile tokens.
 */
export async function touchEmployeeSourceRevision(tx: DbTx, id: string): Promise<string> {
  const [saved] = await tx.$queryRaw<Array<{ sourceRevision: string }>>`
    UPDATE employees SET updated_at=GREATEST(clock_timestamp(), updated_at + INTERVAL '1 microsecond')
    WHERE id=${id}::uuid
    RETURNING to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "sourceRevision"
  `;
  if (!saved) throw new NotFoundException('Сотрудник не найден');
  return saved.sourceRevision;
}
