import 'reflect-metadata';
import { Controller, Get, Inject, Injectable, Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module';
import { PROVIDER } from '../channels/ari-publisher';
import { CHANNELS_REPOSITORY, type ChannelsRepository } from '../channels/channels.repository';
import { PrismaService } from '../database/prisma.provider';

export interface DataFreshness {
  checkedAt: string;
  /** Последняя синхронизация из Exely: запись exely.sync (ADR-032), до неё — полная выгрузка с trigger=import */
  exely: { lastSyncAt: string | null; mode: 'auto' | 'manual' | null };
  /** Последнее событие из Channex (webhook или опрос ленты) и очередь исходящих изменений ARI */
  channex: {
    lastEventAt: string | null;
    outboxPending: number;
    outboxFailed: number;
    oldestPendingAt: string | null;
  };
}

type AuditRow = { createdAt: Date; after?: unknown } | null;
type AuditReader = {
  db: { auditLog: { findFirst(args: unknown): Promise<AuditRow> } };
};

const latest = (...dates: Array<Date | null | undefined>) => {
  const times = dates.filter((d): d is Date => d instanceof Date).map((d) => d.getTime());
  return times.length ? new Date(Math.max(...times)) : null;
};

/**
 * Насколько свежи данные на экране стойки (план wetop-live-data, шаг 4). Только чтение БД:
 * без обращений к Exely и Channex, чтобы строку можно было обновлять раз в минуту.
 */
@Injectable()
export class FreshnessService {
  constructor(
    @Inject(PrismaService) private readonly prisma: AuditReader,
    @Inject(CHANNELS_REPOSITORY) private readonly channels: ChannelsRepository,
  ) {}

  async snapshot(now = new Date()): Promise<DataFreshness> {
    const [sync, importSync, webhookAt, pullAt, outbox] = await Promise.all([
      this.prisma.db.auditLog.findFirst({
        where: { action: 'exely.sync' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, after: true },
      }),
      this.prisma.db.auditLog.findFirst({
        where: { action: 'channex.fullSync', after: { path: ['trigger'], equals: 'import' } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      this.channels.lastEventAt(PROVIDER, 'WEBHOOK'),
      this.channels.lastEventAt(PROVIDER, 'PULL'),
      this.channels.outboxSummary(PROVIDER),
    ]);
    const syncAt = latest(sync?.createdAt, importSync?.createdAt);
    const mode = (sync?.after as { mode?: string } | undefined)?.mode;
    return {
      checkedAt: now.toISOString(),
      exely: {
        lastSyncAt: syncAt?.toISOString() ?? null,
        mode:
          syncAt && sync && syncAt.getTime() === sync.createdAt.getTime()
            ? mode === 'auto' || mode === 'manual'
              ? mode
              : null
            : syncAt
              ? 'manual'
              : null,
      },
      channex: {
        lastEventAt: latest(webhookAt, pullAt)?.toISOString() ?? null,
        outboxPending: outbox.pending,
        outboxFailed: outbox.failed,
        oldestPendingAt: outbox.oldestPendingAt,
      },
    };
  }
}

@Controller('system')
export class FreshnessController {
  constructor(@Inject(FreshnessService) private readonly service: FreshnessService) {}
  @Get('freshness') freshness() {
    return this.service.snapshot();
  }
}

@Module({
  imports: [ChannelsModule],
  controllers: [FreshnessController],
  providers: [PrismaService, FreshnessService],
})
export class FreshnessModule {}
