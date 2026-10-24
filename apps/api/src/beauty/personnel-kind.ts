import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { parsePersonnelKind, type PersonnelKind } from '@pms/domain';
import type { DbTx } from '@pms/database';
import { employeeProfileRevision } from '../employee-portal/employee-common';

/**
 * Назначение сотрудника в «Персонале» (DATA_MODEL.md, решения 18.10 и 20.10.2026): специалист, другой сотрудник или
 * оба. Версия профиля та же, что у PATCH employees/:id (updated_at в микросекундах), поэтому смена назначения и
 * правка карточки в другом окне не затирают друг друга.
 */
type PersonnelDb = Pick<DbTx, '$queryRaw'>;
type PersonnelScope = { organizationId: string; businessId: string };
type PersonnelRow = { id: string; personnelKind: PersonnelKind | null; profileRevision: string };
const STALE = 'Сотрудник изменён в другом окне. Обновите список и выберите назначение снова.';

export function parsePersonnelKindCommand(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
      Object.keys(raw).some(key => !['personnelKind', 'expectedProfileRevision'].includes(key)))
    throw new BadRequestException('Нужны только назначение и версия профиля');
  const body = raw as Record<string, unknown>;
  let personnelKind: PersonnelKind;
  try { personnelKind = parsePersonnelKind(body.personnelKind); }
  catch { throw new BadRequestException('Назначение: специалист, другой сотрудник или оба'); }
  return { personnelKind, expectedProfileRevision: employeeProfileRevision(body.expectedProfileRevision) };
}

/** Создание: поле необязательно (старые клиенты), но пришедшее значение обязано быть одним из трёх */
export function parseCreatePersonnelKind(raw: unknown): PersonnelKind | null {
  const body = (raw ?? {}) as Record<string, unknown>;
  if (body.personnelKind === undefined) return null;
  try { return parsePersonnelKind(body.personnelKind); }
  catch { throw new BadRequestException('Назначение: специалист, другой сотрудник или оба'); }
}

/** Права руководителя, property, записываемость и транзакцию области держит вызывающий */
export async function writePersonnelKind(
  tx: PersonnelDb, scope: PersonnelScope, id: string,
  input: ReturnType<typeof parsePersonnelKindCommand>,
) {
  const [before] = await tx.$queryRaw<PersonnelRow[]>`
    SELECT e.id::text, e.personnel_kind AS "personnelKind",
      to_char(e.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "profileRevision"
    FROM employees e JOIN businesses b ON b.id=e.business_id
    WHERE e.id=${id}::uuid AND e.business_id=${scope.businessId}::uuid
      AND b.organization_id=${scope.organizationId}::uuid FOR UPDATE OF e
  `;
  if (!before) throw new NotFoundException('Сотрудник не найден');
  if (before.profileRevision !== input.expectedProfileRevision) throw new ConflictException(STALE);
  const [after] = await tx.$queryRaw<PersonnelRow[]>`
    UPDATE employees e SET personnel_kind=${input.personnelKind},
      updated_at=GREATEST(clock_timestamp(), e.updated_at + INTERVAL '1 microsecond')
    WHERE e.id=${id}::uuid AND e.business_id=${scope.businessId}::uuid
      AND EXISTS (SELECT 1 FROM businesses b WHERE b.id=e.business_id AND b.organization_id=${scope.organizationId}::uuid)
      AND to_char(e.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')=${input.expectedProfileRevision}
    RETURNING e.id::text, e.personnel_kind AS "personnelKind",
      to_char(e.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "profileRevision"
  `;
  if (!after) throw new ConflictException(STALE);
  return { before, after };
}
