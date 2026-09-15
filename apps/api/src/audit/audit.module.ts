import 'reflect-metadata';
import { Controller, Get, Inject, Injectable, Module, Query } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';

export interface AuditRow {
  id: string;
  at: string;
  entityType: string;
  entityId: string;
  action: string;
  /** Короткая сводка без ПД: номер брони / код ячейки, если есть в снимке */
  subject: string | null;
  /**
   * Кто это сделал: имя вошедшего сотрудника (ADR-023, DATA_MODEL §13 шаг 1). `null` — система: импорт из
   * Exely, сторож, скрипт сверки. Почта сотрудника сюда не идёт — на экране довольно имени.
   */
  author: string | null;
}

/** Служебные строки: синхронизация Exely пишет одну каждые 5 минут и вытесняет из журнала действия людей */
export const SYSTEM_AUDIT_ACTIONS = ['exely.sync'];
/** Ключи снимка, по которым ищет журнал: номер брони, код ячейки, номер брони канала */
const SUBJECT_KEYS = ['confirmationNumber', 'code', 'uniqueId'] as const;

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
    const rows = await this.prisma.db.auditLog.findMany({
      where: {
        ...(q.entityType ? { entityType: q.entityType } : {}),
        ...(q.action ? { action: { startsWith: q.action } } : {}),
        ...(q.system || q.action ? {} : { NOT: { action: { in: SYSTEM_AUDIT_ACTIONS } } }),
        ...(text
          ? {
              OR: SUBJECT_KEYS.flatMap((key) => [
                { after: { path: [key], string_contains: text } },
                { before: { path: [key], string_contains: text } },
              ]),
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(q.limit ?? 100, 1), 500),
      include: { user: { select: { fullName: true } } },
    });
    return rows.map((r) => {
      const after = (r.after ?? r.before) as Record<string, unknown> | null;
      const subject =
        after && typeof after === 'object'
          ? ((after['confirmationNumber'] as string | undefined) ??
            (after['code'] as string | undefined) ??
            (after['uniqueId'] as string | undefined) ??
            null)
          : null;
      return {
        id: r.id,
        at: r.createdAt.toISOString(),
        entityType: r.entityType,
        entityId: r.entityId,
        action: r.action,
        subject,
        author: r.user?.fullName ?? null,
      };
    });
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
