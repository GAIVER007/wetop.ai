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
}

/** Журнал действий (SECURITY §6): что, когда, с чем. Без ПД в сводке. */
@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async list(q: {
    limit?: number | undefined;
    entityType?: string | undefined;
    action?: string | undefined;
  }): Promise<AuditRow[]> {
    const rows = await this.prisma.db.auditLog.findMany({
      where: {
        ...(q.entityType ? { entityType: q.entityType } : {}),
        ...(q.action ? { action: { startsWith: q.action } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(q.limit ?? 100, 1), 500),
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
  ) {
    return this.service.list({
      limit: limit ? Number(limit) : undefined,
      entityType: entityType || undefined,
      action: action || undefined,
    });
  }
}

@Module({ controllers: [AuditController], providers: [PrismaService, AuditService] })
export class AuditModule {}
