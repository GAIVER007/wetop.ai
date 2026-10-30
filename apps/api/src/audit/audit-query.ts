import { BadRequestException } from '@nestjs/common';
import { isIsoDate, PLATFORM_TIMEZONE, periodBoundsUtc } from '@pms/domain';
import { Prisma } from '@pms/database';

export interface AuditQuery {
  limit?: number | undefined;
  entityType?: string | undefined;
  action?: string | undefined;
  q?: string | undefined;
  system?: boolean | undefined;
  actor?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  timezone?: string | undefined;
  group?: string | undefined;
  cursor?: string | undefined;
}

/**
 * Разделы риска (владелец 30.10.2026: «история создана для предотвращения краж: сделал скидку, отменил запись,
 * удалил клиента»). Считаются в базе по коду действия и снимку: скидка только когда цена стала меньше.
 */
export const RISK_KINDS = ['discount', 'cancel', 'delete', 'refund', 'access'] as const;
export type RiskKind = (typeof RISK_KINDS)[number];
export const RISK_SQL = Prisma.sql`(CASE
  WHEN a."action" = 'beauty.appointment.price_adjusted'
       AND (a."after"->>'priceMinor') ~ '^-?[0-9]+$' AND (a."before"->>'priceMinor') ~ '^-?[0-9]+$'
       AND (a."after"->>'priceMinor')::numeric < (a."before"->>'priceMinor')::numeric THEN 'discount'
  WHEN a."action" IN ('beauty.bonus.adjusted') THEN 'discount'
  WHEN a."action" = 'beauty.appointment.status' AND a."after"->>'status' IN ('CANCELLED', 'NO_SHOW') THEN 'cancel'
  WHEN a."action" IN ('reservation.cancel', 'reservation.noShow') THEN 'cancel'
  WHEN a."action" IN ('beauty.appointment.refunded', 'finance.refund', 'finance.payment.void', 'finance.payment.replaced',
                      'finance.cash.operation.void', 'finance.charge.void', 'bar.sale.reversed') THEN 'refund'
  WHEN a."action" LIKE '%.removed' OR a."action" LIKE '%.delete' OR a."action" LIKE '%.deleted'
       OR a."action" LIKE '%.archived' OR a."action" IN ('beauty.customer_import.undone', 'user.blocked') THEN 'delete'
  WHEN a."action" IN ('user.login', 'user.password.changed', 'membership.role.updated', 'membership.suspended',
                      'membership.resumed', 'invite.created', 'invite.accepted', 'employee.account_linked') THEN 'access'
END)`;
/** Деньги строки риска: на сколько снизили цену, сколько вернули или стоила отменённая запись */
export const RISK_MINOR_SQL = Prisma.sql`(CASE
  WHEN (a."before"->>'priceMinor') ~ '^-?[0-9]+$' AND (a."after"->>'priceMinor') ~ '^-?[0-9]+$'
       THEN GREATEST((a."before"->>'priceMinor')::numeric - (a."after"->>'priceMinor')::numeric, 0)
  WHEN (a."after"->>'amountMinor') ~ '^-?[0-9]+$' THEN ABS((a."after"->>'amountMinor')::numeric)
  WHEN (a."before"->>'amountMinor') ~ '^-?[0-9]+$' THEN ABS((a."before"->>'amountMinor')::numeric)
  ELSE 0 END)`;

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export function auditFilters(q: AuditQuery): Prisma.Sql[] {
  const bad = (message: string): never => {
    throw new BadRequestException(message);
  };
  if (q.limit !== undefined && (!Number.isInteger(q.limit) || q.limit < 1 || q.limit > 500))
    bad('Размер страницы: целое число от 1 до 500.');
  if ((q.from && !isIsoDate(q.from)) || (q.to && !isIsoDate(q.to))) bad('Проверьте даты периода.');
  if (q.from && q.to && q.from > q.to) bad('Начало периода должно быть не позже окончания.');
  if (q.q && q.q.length > 200) bad('Поиск: не больше 200 символов.');
  if ((q.action?.length ?? 0) > 100 || (q.entityType?.length ?? 0) > 100)
    bad('Слишком длинный фильтр.');
  const where: Prisma.Sql[] = [];
  if (q.actor === 'system') where.push(Prisma.sql`a."user_id" IS NULL`);
  else if (q.actor) {
    if (!UUID.test(q.actor)) bad('Некорректный сотрудник.');
    where.push(Prisma.sql`a."user_id" = ${q.actor}::uuid`);
  }
  const tz = q.timezone || PLATFORM_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
  } catch {
    bad('Неизвестный часовой пояс.');
  }
  if (q.from)
    where.push(Prisma.sql`a."created_at" >= ${periodBoundsUtc(q.from, q.from, tz).startUtc}`);
  if (q.to)
    where.push(Prisma.sql`a."created_at" < ${periodBoundsUtc(q.to, q.to, tz).endUtcExclusive}`);
  if (q.group === 'finance')
    where.push(Prisma.sql`(a."action" LIKE ${'finance.%'} OR a."action" LIKE ${'bar.%'})`);
  else if (q.group === 'staff')
    where.push(
      Prisma.sql`(a."action" LIKE ${'membership.%'} OR a."action" LIKE ${'invite.%'} OR a."action" LIKE ${'user.%'})`,
    );
  else if (q.group === 'risk') where.push(Prisma.sql`${RISK_SQL} IN ('discount', 'cancel', 'delete', 'refund') AND ${RISK_SQL} IS NOT NULL`);
  else if (q.group && (RISK_KINDS as readonly string[]).includes(q.group)) where.push(Prisma.sql`${RISK_SQL} = ${q.group}`);
  else if (q.group) bad('Неизвестный раздел журнала.');
  if (q.cursor) {
    const [at, id, extra] = q.cursor.split('|');
    if (
      !at ||
      !id ||
      extra !== undefined ||
      !UUID.test(id) ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3,6}Z$/.test(at) ||
      !Number.isFinite(Date.parse(at))
    )
      bad('Некорректная страница журнала.');
    // Строка сохраняет микросекунды PostgreSQL. JS Date обрезал бы их до миллисекунд.
    where.push(Prisma.sql`(a."created_at", a."id") < (${at}::timestamptz, ${id}::uuid)`);
  }
  return where;
}

// Только короткие скалярные поля. Исходные снимки, контакты и документы не покидают БД.
const SAFE_KEYS = [
  'amountMinor',
  'priceMinor',
  'paidMinor',
  'currency',
  'commissionMinor',
  'kind',
  'method',
  'methodTo',
  'category',
  'status',
  'voided',
  'role',
  'userId',
  'position',
  'phoneChanged',
  'active',
  'confirmationNumber',
  'code',
  'checkIn',
  'checkOut',
  'quantity',
  'unitPriceMinor',
  'reason',
  'note',
  'operationId',
  'paymentId',
  'chargeId',
  'folioId',
  'commissionId',
  'inviteId',
  'expectedMinor',
  'actualMinor',
  'differenceMinor',
  'countedMinor',
  'amount',
  'revenue',
  'cost',
  'restock',
  'name',
  'deliveryFailed',
];

export function safeSnapshot(column: 'before' | 'after'): Prisma.Sql {
  const snapshot = column === 'before' ? Prisma.sql`a."before"` : Prisma.sql`a."after"`;
  return Prisma.sql`(SELECT COALESCE(jsonb_object_agg(k, ${snapshot}->k), '{}'::jsonb)
    FROM unnest(${SAFE_KEYS}::text[]) AS fields(k)
    WHERE jsonb_typeof(${snapshot}->k) IN ('string', 'number', 'boolean', 'null')
      AND octet_length((${snapshot}->k)::text) <= 600
      AND (a."action" LIKE 'finance.%' OR a."action" LIKE 'membership.%' OR a."action" LIKE 'invite.%' OR a."action" LIKE 'bar.%'
        OR a."action" LIKE 'beauty.appointment.%'))`;
}
