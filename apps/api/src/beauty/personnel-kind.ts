import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { parsePersonnelKind, type PersonnelKind } from '@pms/domain';
import type { DbTx } from '@pms/database';
import { employeeProfileRevision, type EmployeeCommon } from '../employee-portal/employee-common';

type PersonnelDb = Pick<DbTx, '$queryRaw'>;
type PersonnelScope = { organizationId: string; businessId: string };
type PersonnelRow = { id: string; personnelKind: PersonnelKind | null; profileRevision: string };
export const personnelKindEnabled = () => process.env.PERSONNEL_KIND_ENABLED === '1';
const unavailable = () => new ServiceUnavailableException('Personnel kind unavailable');

export function parsePersonnelKindCommand(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
      Object.keys(raw).some(key => !['personnelKind', 'expectedProfileRevision'].includes(key)))
    throw new BadRequestException('Invalid personnel kind command');
  const body = raw as Record<string, unknown>;
  let personnelKind: PersonnelKind;
  try { personnelKind = parsePersonnelKind(body.personnelKind); }
  catch { throw new BadRequestException('Invalid personnel kind'); }
  return { personnelKind, expectedProfileRevision: employeeProfileRevision(body.expectedProfileRevision) };
}

/** Full canonical business list narrowed by verified organization; one row snapshot.
 * Always references the held column when ON, including an empty business.
 */
export async function readPersonnelEmployeeProfiles(db: PersonnelDb, scope: PersonnelScope): Promise<Array<EmployeeCommon & { personnelKind: PersonnelKind | null }>> {
  if (!personnelKindEnabled()) return [];
  try {
    const rows = await db.$queryRaw<Array<EmployeeCommon & { personnelKind: PersonnelKind | null }>>`
      SELECT e.id::text, e.name, e.phone, e.email, e.status::text AS status,
        to_char(e.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "profileRevision",
        e.personnel_kind AS "personnelKind"
      FROM employees e JOIN businesses b ON b.id=e.business_id
      WHERE e.business_id=${scope.businessId}::uuid AND b.organization_id=${scope.organizationId}::uuid
      ORDER BY e.status ASC, e.name ASC, e.id ASC
    `;
    return rows.map(row => ({ ...row, personnelKind: row.personnelKind === null ? null : parsePersonnelKind(row.personnelKind) }));
  } catch { throw unavailable(); }
}

/** Caller owns manager/property/writeability checks and the scoped transaction. */
export async function writePersonnelKind(tx: PersonnelDb, scope: PersonnelScope, id: string, input: ReturnType<typeof parsePersonnelKindCommand>) {
  if (!personnelKindEnabled()) throw unavailable();
  let before: PersonnelRow | undefined;
  try {
    [before] = await tx.$queryRaw<PersonnelRow[]>`
      SELECT e.id::text, e.personnel_kind AS "personnelKind",
        to_char(e.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "profileRevision"
      FROM employees e JOIN businesses b ON b.id=e.business_id
      WHERE e.id=${id}::uuid AND e.business_id=${scope.businessId}::uuid
        AND b.organization_id=${scope.organizationId}::uuid FOR UPDATE OF e
    `;
  } catch { throw unavailable(); }
  if (!before) throw new NotFoundException('Employee not found');
  if (before.profileRevision !== input.expectedProfileRevision) throw new ConflictException('Profile changed; reload before assigning personnel kind');
  let after: PersonnelRow | undefined;
  try {
    [after] = await tx.$queryRaw<PersonnelRow[]>`
      UPDATE employees e SET personnel_kind=${input.personnelKind},
        updated_at=GREATEST(clock_timestamp(), e.updated_at + INTERVAL '1 microsecond')
      WHERE e.id=${id}::uuid AND e.business_id=${scope.businessId}::uuid
        AND EXISTS (SELECT 1 FROM businesses b WHERE b.id=e.business_id AND b.organization_id=${scope.organizationId}::uuid)
        AND to_char(e.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')=${input.expectedProfileRevision}
      RETURNING e.id::text, e.personnel_kind AS "personnelKind",
        to_char(e.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "profileRevision"
    `;
  } catch { throw unavailable(); }
  if (!after) throw new ConflictException('Profile changed; reload before assigning personnel kind');
  return { before, after };
}
