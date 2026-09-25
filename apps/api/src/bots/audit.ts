import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import { auditUserId } from '../accounts/actor';
import { PrismaService } from '../database/prisma.provider';

/**
 * Журнал действий с панелью бота (ADR-023): перехват, ответ, возврат, загрузка знаний — строкой `audit_logs` с автором.
 * Текст переписки в журнал не идёт — только факт и размер: переписка живёт у бота.
 */
export interface BotAudit {
  record(event: {
    entityType: string;
    entityId: string;
    action: string;
    after: Record<string, unknown>;
  }): Promise<void>;
}

@Injectable()
export class PrismaBotAudit implements BotAudit {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(event: {
    entityType: string;
    entityId: string;
    action: string;
    after: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.db.auditLog.create({
      data: {
        userId: auditUserId(),
        entityType: event.entityType,
        entityId: event.entityId,
        action: event.action,
        after: JSON.parse(JSON.stringify(event.after)),
      },
    });
  }
}
