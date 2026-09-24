import 'reflect-metadata';
import { Controller, Get, Inject, Injectable, Module, Query } from '@nestjs/common';
import { Prisma } from '@pms/database';
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
import { currentOrganizationId, hasSignedInActor } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { propertyIdRef } from '../database/property-ref';

export interface AuditRow {
  id: string;
  at: string;
  entityType: string;
  entityId: string;
  action: string;
  /** Короткая сводка без ПД: номер брони / код ячейки, если есть в снимке */
  subject: string | null;
  /** Для брони: существует ли карточка, на которую можно перейти. Для остальных сущностей — null. */
  targetAvailable: boolean | null;
  /**
   * Кто это сделал: имя вошедшего сотрудника (ADR-023, DATA_MODEL §13.2). `null` — система: импорт из
   * Exely, сторож, скрипт сверки. Почта сотрудника сюда не идёт — на экране довольно имени.
   */
  author: string | null;
}

/** Служебные строки: синхронизация Exely пишет одну каждые 5 минут и вытесняет из журнала действия людей */
export const SYSTEM_AUDIT_ACTIONS = ['exely.sync'];
/**
 * Короткая сводка строки журнала прямо в SQL: тот же порядок, что был в коде, —
 * берём снимок `after`, а если его нет, `before`; в снимке — номер брони, код ячейки, номер канала.
 * Считается в базе, чтобы наружу не ехали сами снимки (волна 4).
 */
const SUBJECT_SQL = Prisma.sql`COALESCE(
  CASE WHEN a."after" IS NOT NULL AND jsonb_typeof(a."after") = 'object'
       THEN COALESCE(a."after"->>'confirmationNumber', a."after"->>'code', a."after"->>'uniqueId') END,
  CASE WHEN a."after" IS NULL OR jsonb_typeof(a."after") = 'null'
       THEN COALESCE(a."before"->>'confirmationNumber', a."before"->>'code', a."before"->>'uniqueId') END
)`;

/** Журнал действий (SECURITY §6): что, когда, с чем. Без ПД в сводке. */
@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async list(q: {
    limit?: number | undefined;
    entityType?: string | undefined;
    action?: string | undefined;
    /** Номер брони или код ячейки: ищется в снимках всей истории, не в последних строках */
    q?: string | undefined;
    /** Показывать служебные строки (синхронизация Exely) */
    system?: boolean | undefined;
  }): Promise<AuditRow[]> {
    const text = q.q?.trim();
    const take = Math.min(Math.max(q.limit ?? 100, 1), 500);
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (q.entityType) where.push(Prisma.sql`a."entity_type" = ${q.entityType}`);
    if (q.action) where.push(Prisma.sql`a."action" LIKE ${`${q.action}%`}`);
    if (!q.system && !q.action)
      where.push(Prisma.sql`a."action" <> ALL(${SYSTEM_AUDIT_ACTIONS}::text[])`);
    if (text) where.push(Prisma.sql`${SUBJECT_SQL} LIKE ${`%${text}%`}`);
    // Замок организаций (ADR-061, Q-152): вошедший видит записи только о сущностях своего объекта и своих сотрудниках
    if (hasSignedInActor()) where.push(await ownAuditRows(this.prisma.db));
    // Волна 4: снимки брони в списке не нужны — из них берут одну короткую строку. На bulk-правке цен
    // и на импорте `after` весит мегабайты, и 200 строк тянули их целиком через пулер в Сингапур.
    // Автор — имя из учётной записи (§13.2): почта сотрудника в журнал не выводится.
    const rows = await this.prisma.db.$queryRaw<
      Array<{
        id: string;
        created_at: Date;
        entity_type: string;
        entity_id: string;
        action: string;
        subject: string | null;
        target_available: boolean | null;
        author: string | null;
      }>
    >`
      SELECT a."id", a."created_at", a."entity_type", a."entity_id", a."action", ${SUBJECT_SQL} AS "subject",
             CASE WHEN a."entity_type" = 'Reservation' THEN reservation_target."id" IS NOT NULL ELSE NULL END
               AS "target_available",
             u."name" AS "author"
      FROM "audit_logs" a
      LEFT JOIN "users" u ON u."id" = a."user_id"
      LEFT JOIN "reservations" reservation_target
        ON a."entity_type" = 'Reservation' AND reservation_target."id"::text = a."entity_id"
      WHERE ${Prisma.join(where, ' AND ')}
      ORDER BY a."created_at" DESC
      LIMIT ${take}`;
    return rows.map((r) => ({
      id: r.id,
      at: r.created_at.toISOString(),
      entityType: r.entity_type,
      entityId: r.entity_id,
      action: r.action,
      subject: r.subject,
      targetAvailable: r.target_available,
      author: r.author ?? null,
    }));
  }
}

/**
 * Строки журнала своей организации. У `audit_logs` нет объекта: принадлежность выводится по типу сущности через её
 * таблицу. Незнакомый тип вошедшему не показывается — лучше не показать своё, чем показать чужое.
 */
async function ownAuditRows(db: PrismaService['db']): Promise<Prisma.Sql> {
  const propertyId = await propertyIdRef(db, LUXX_APARTS_PROPERTY.name);
  const organizationId = currentOrganizationId();
  const p = Prisma.sql`${propertyId}::uuid`;
  return Prisma.sql`(
    (a."entity_type" = 'Property' AND a."entity_id" = ${propertyId})
    OR (a."entity_type" = 'Reservation' AND a."entity_id" IN (
      SELECT r."id"::text FROM "reservations" r WHERE r."property_id" = ${p}))
    OR (a."entity_type" = 'ReservationItem' AND a."entity_id" IN (
      SELECT i."id"::text FROM "reservation_items" i JOIN "reservations" r ON r."id" = i."reservation_id"
      WHERE r."property_id" = ${p}))
    OR (a."entity_type" = 'Folio' AND a."entity_id" IN (
      SELECT f."id"::text FROM "folios" f
      JOIN "reservation_items" i ON i."id" = f."reservation_item_id"
      JOIN "reservations" r ON r."id" = i."reservation_id"
      WHERE r."property_id" = ${p}))
    OR (a."entity_type" = 'Payment' AND a."entity_id" IN (
      SELECT pay."id"::text FROM "payments" pay WHERE pay."property_id" = ${p}))
    OR (a."entity_type" = 'InventoryUnit' AND a."entity_id" IN (
      SELECT u."id"::text FROM "inventory_units" u
      JOIN "accommodation_types" t ON t."id" = u."accommodation_type_id" WHERE t."property_id" = ${p}))
    OR (a."entity_type" = 'TrackedSite' AND a."entity_id" IN (
      SELECT s."id"::text FROM "tracked_sites" s WHERE s."property_id" = ${p}))
    OR (a."entity_type" = 'Guest' AND a."entity_id" IN (
      SELECT r."primary_guest_id"::text FROM "reservations" r
      WHERE r."property_id" = ${p} AND r."primary_guest_id" IS NOT NULL
      UNION
      SELECT sg."guest_id"::text FROM "stay_guests" sg
      JOIN "reservation_items" i ON i."id" = sg."reservation_item_id"
      JOIN "reservations" r ON r."id" = i."reservation_id"
      WHERE r."property_id" = ${p}))
    OR (a."entity_type" = 'user' AND a."entity_id" IN (
      SELECT m."user_id"::text FROM "memberships" m WHERE m."organization_id" = ${organizationId}::uuid))
  )`;
}

@Controller('audit')
export class AuditController {
  constructor(@Inject(AuditService) private readonly service: AuditService) {}
  @Get()
  list(
    @Query('limit') limit?: string,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('q') q?: string,
    @Query('system') system?: string,
  ) {
    return this.service.list({
      limit: limit ? Number(limit) : undefined,
      entityType: entityType || undefined,
      action: action || undefined,
      q: q || undefined,
      system: system === '1',
    });
  }
}

@Module({ controllers: [AuditController], providers: [PrismaService, AuditService] })
export class AuditModule {}
