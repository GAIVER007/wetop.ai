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
      AND (a."action" LIKE 'finance.%' OR a."action" LIKE 'membership.%' OR a."action" LIKE 'invite.%' OR a."action" LIKE 'bar.%'))`;
}
