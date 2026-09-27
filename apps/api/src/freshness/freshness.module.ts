import 'reflect-metadata';
import { Controller, Get, Inject, Injectable, Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module';
import { PROVIDER } from '../channels/ari-publisher';
import { CHANNELS_REPOSITORY, type ChannelsRepository } from '../channels/channels.repository';
import { Access } from '../auth/access.decorator';

export interface DataFreshness {
  checkedAt: string;
  /** Последнее событие из Channex (webhook или опрос ленты) и очередь исходящих изменений ARI */
  channex: {
    lastEventAt: string | null;
    outboxPending: number;
    outboxFailed: number;
    oldestPendingAt: string | null;
  };
}

const latest = (...dates: Array<Date | null | undefined>) => {
  const times = dates.filter((d): d is Date => d instanceof Date).map((d) => d.getTime());
  return times.length ? new Date(Math.max(...times)) : null;
};

/**
 * Насколько свежи данные на экране стойки (план wetop-live-data, шаг 4). Только чтение БД, без обращений к
 * Channex, чтобы строку можно было обновлять раз в минуту. Строки Exely здесь больше нет: объект в Exely не
 * работает (ADR-052, ADR-073).
 */
@Injectable()
export class FreshnessService {
  constructor(@Inject(CHANNELS_REPOSITORY) private readonly channels: ChannelsRepository) {}

  async snapshot(now = new Date()): Promise<DataFreshness> {
    const [webhookAt, pullAt, outbox] = await Promise.all([
      this.channels.lastEventAt(PROVIDER, 'WEBHOOK'),
      this.channels.lastEventAt(PROVIDER, 'PULL'),
      this.channels.outboxSummary(PROVIDER),
    ]);
    return {
      checkedAt: now.toISOString(),
      channex: {
        lastEventAt: latest(webhookAt, pullAt)?.toISOString() ?? null,
        outboxPending: outbox.pending,
        outboxFailed: outbox.failed,
        oldestPendingAt: outbox.oldestPendingAt,
      },
    };
  }
}

@Access('desk')
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
  providers: [FreshnessService],
})
export class FreshnessModule {}
