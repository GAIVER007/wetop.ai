import 'reflect-metadata';
import { Controller, Get, Inject, Injectable, Module, Query } from '@nestjs/common';
import { Prisma } from '@pms/database';
import { PrismaService } from '../database/prisma.provider';

export interface AuditRow {
  id: string;
  at: string;
  entityType: string;
  entityId: string;
  action: string;
  /** Короткая сводка без ПД: номер брони / код ячейки, если есть в снимке */
  subject: string | null;
}

/** Служебные строки: синхронизация Exely пишет одну каждые 5 минут и вытесняет из журнала действия людей */
export const SYSTEM_AUDIT_ACTIONS = ['exely.sync'];
/**
 * Короткая сводка строки журнала прямо в SQL: тот же порядок, что был в коде, —
 * берём снимок `after`, а если его нет, `before`; в снимке — номер брони, код ячейки, номер канала.
 * Считается в базе, чтобы наружу не ехали сами снимки (волна 4).
 */
const SUBJECT_SQL = Prisma.sql`COALESCE(
  CASE WHEN "after" IS NOT NULL AND jsonb_typeof("after") = 'object'
       THEN COALESCE("after"->>'confirmationNumber', "after"->>'code', "after"->>'uniqueId') END,
  CASE WHEN "after" IS NULL OR jsonb_typeof("after") = 'null'
       THEN COALESCE("before"->>'confirmationNumber', "before"->>'code', "before"->>'uniqueId') END
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
    if (q.entityType) where.push(Prisma.sql`"entity_type" = ${q.entityType}`);
    if (q.action) where.push(Prisma.sql`"action" LIKE ${`${q.action}%`}`);
    if (!q.system && !q.action)
      where.push(Prisma.sql`"action" <> ALL(${SYSTEM_AUDIT_ACTIONS}::text[])`);
    if (text) where.push(Prisma.sql`${SUBJECT_SQL} LIKE ${`%${text}%`}`);
    // Волна 4: снимки брони в списке не нужны — из них берут одну короткую строку. На bulk-правке цен
    // и на импорте `after` весит мегабайты, и 200 строк тянули их целиком через пулер в Сингапур.
    const rows = await this.prisma.db.$queryRaw<
      Array<{
        id: string;
        created_at: Date;
        entity_type: string;
        entity_id: string;
        action: string;
        subject: string | null;
      }>
    >`
      SELECT "id", "created_at", "entity_type", "entity_id", "action", ${SUBJECT_SQL} AS "subject"
      FROM "audit_logs"
      WHERE ${Prisma.join(where, ' AND ')}
      ORDER BY "created_at" DESC
      LIMIT ${take}`;
    return rows.map((r) => ({
      id: r.id,
      at: r.created_at.toISOString(),
      entityType: r.entity_type,
      entityId: r.entity_id,
      action: r.action,
      subject: r.subject,
    }));
  }
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
