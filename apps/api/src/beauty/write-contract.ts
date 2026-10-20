import { createHash, createHmac } from 'node:crypto';
import { BadRequestException, ConflictException } from '@nestjs/common';
import type { DbTx, Prisma } from '@pms/database';
import { readEmployeeWeekSource } from '../employee-portal/employee-common';
import { currentUserId } from '../auth/request-context';
import { UUID, type BeautyScope } from './scope';

export function canonicalRevision(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export function assertRevision(raw: unknown, current: string): void {
  if (!raw || typeof raw !== 'object') return;
  const expected = (raw as Record<string, unknown>).expectedRevision;
  // Legacy callers retain their contract; the new editors always submit the read revision.
  if (expected === undefined) return;
  if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected))
    throw new BadRequestException('Некорректная версия данных');
  if (expected !== current)
    throw new ConflictException(
      'Данные изменены в другом окне. Сравните с актуальными данными перед сохранением.',
    );
}
/** Weekly writes always submit the original read token, including an empty week. */
export function assertWeekRevision(raw: unknown, current: string): void {
  if (!raw || typeof raw !== 'object' || typeof (raw as Record<string, unknown>).expectedRevision !== 'string')
    throw new BadRequestException('Пришлите исходную версию графика');
  assertRevision(raw, current);
}
export function hoursRowsRevision(rows: ReadonlyArray<{ id: string; weekday: number; timeFrom: Date; timeTo: Date }>, sourceRevision: string): string {
  return canonicalRevision([sourceRevision, [...rows].sort((a,b) => a.weekday - b.weekday || a.timeFrom.getTime() - b.timeFrom.getTime()).map(r => [r.id, r.weekday, r.timeFrom.toISOString(), r.timeTo.toISOString()])]);
}
export function creationKey(raw: unknown): string | null {
  const value =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>).creationId : undefined;
  if (value === undefined) return null;
  if (typeof value !== 'string' || !UUID.test(value))
    throw new BadRequestException('Некорректный ключ создания');
  return value.toLowerCase();
}
export function receiptFor(
  scope: BeautyScope,
  kind: string,
  input: unknown,
): Prisma.InputJsonObject {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16)
    throw new ConflictException('Защищённое создание временно недоступно. Повторите позже.');
  const fingerprint = createHmac('sha256', secret)
    .update(
      JSON.stringify(
        {
          version: 1,
          kind,
          organizationId: scope.organizationId,
          businessId: scope.businessId,
          locationId: scope.locationId,
          initiatorId: currentUserId(),
          input,
        },
        (_, v: unknown) => (typeof v === 'bigint' ? v.toString() : v),
      ),
    )
    .digest('hex');
  return { version: 1, fingerprint, locationId: scope.locationId };
}
export async function assertCreationReceipt(
  tx: DbTx,
  scope: BeautyScope,
  kind: string,
  id: string,
  receipt: Prisma.InputJsonObject,
): Promise<void> {
  const event = await tx.auditLog.findFirst({
    where: {
      organizationId: scope.organizationId,
      entityType: kind,
      entityId: id,
      action: kind === 'employee' ? 'beauty.employee.created' : 'beauty.service.created',
    },
    select: { after: true },
  });
  const after = event?.after as Record<string, unknown> | null;
  const original = after?.creationReceipt as Record<string, unknown> | undefined;
  if (
    !original ||
    original.version !== 1 ||
    original.fingerprint !== receipt.fingerprint ||
    original.locationId !== scope.locationId
  )
    throw new ConflictException(
      'Создание не подтверждено для этого запроса. Проверьте сохранённый объект, не создавайте повторно.',
    );
}
export async function assertProfileBeforeCreate(tx: DbTx, scope: BeautyScope): Promise<void> {
  if (!scope.locationId) return;
  const saved = await tx.onboardingProgress.findUnique({ where: { locationId: scope.locationId } });
  const draft = saved?.draft as Record<string, unknown> | undefined;
  if (saved?.flowVersion === 2 && draft?.profileApplied !== true)
    throw new ConflictException('Сначала подтвердите валюту и часовой пояс в настройке салона.');
}
export async function skillsRevision(
  tx: Pick<DbTx, 'employeeService'>,
  employeeId: string,
): Promise<string> {
  const rows = await tx.employeeService.findMany({
    where: { employeeId },
    orderBy: { serviceId: 'asc' },
    select: { serviceId: true, createdAt: true },
  });
  return canonicalRevision(rows.map((r) => [r.serviceId, r.createdAt.toISOString()]));
}
export async function hoursRevision(
  tx: Pick<DbTx, '$queryRaw'>,
  employeeId: string,
  locationId: string,
): Promise<string> {
  const snapshot = await readEmployeeWeekSource(tx, employeeId, locationId);
  return hoursRowsRevision(snapshot.rows, snapshot.sourceRevision);
}

/** An old retained receipt reserves the operation even if its resource was administratively removed. */
export async function assertUnusedCreationKey(
  tx: DbTx,
  scope: BeautyScope,
  kind: string,
  id: string,
): Promise<void> {
  const event = await tx.auditLog.findFirst({
    where: {
      organizationId: scope.organizationId,
      entityType: kind,
      entityId: id,
      action: kind === 'employee' ? 'beauty.employee.created' : 'beauty.service.created',
    },
    select: { id: true },
  });
  if (event)
    throw new ConflictException(
      'Результат прежнего создания недоступен. Обратитесь к владельцу; повторный объект не создан.',
    );
}
