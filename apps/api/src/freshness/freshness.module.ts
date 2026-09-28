import 'reflect-metadata';
import { Controller, Get, Inject, Injectable, Module, Req } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module';
import { PROVIDER } from '../channels/ari-publisher';
import { CHANNELS_REPOSITORY, type ChannelsRepository } from '../channels/channels.repository';
import { Access } from '../auth/access.decorator';
import { isIntegrationActor } from '../channels/integration-owner';
import { PrismaService } from '../database/prisma.provider';

export interface DataFreshness {
  checkedAt: string;
  /**
   * Последнее событие из Channex (webhook или опрос ленты) и очередь исходящих изменений ARI. `null` — у гостиницы
   * вошедшего каналы не подключены (план tenant-isolation-2026-09-26 п. 5): строка в меню не рисуется
   */
  channex: {
    lastEventAt: string | null;
    outboxPending: number;
    outboxFailed: number;
    oldestPendingAt: string | null;
  } | null;
}

const latest = (...dates: Array<Date | null | undefined>) => {
  const times = dates.filter((d): d is Date => d instanceof Date).map((d) => d.getTime());
  return times.length ? new Date(Math.max(...times)) : null;
};

/**
 * Насколько свежи данные на экране стойки (план wetop-live-data, шаг 4). Только чтение БД, без обращений к
 * Channex, чтобы строку можно было обновлять раз в минуту.
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
  constructor(
    @Inject(FreshnessService) private readonly service: FreshnessService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}
  /**
   * Состояние Channex — только гостинице с подключёнными каналами и главному администратору. Другим — «каналов нет»,
   * а не 403: меню опрашивает строку раз в минуту, и отказ писался бы в журнал ошибок человека каждую минуту.
   */
  @Get('freshness') async freshness(
    @Req() req: { user?: { organizationId: string; platformAdmin?: boolean } },
  ): Promise<DataFreshness> {
    if (req.user && !(await isIntegrationActor(this.prisma, req.user)))
      return { checkedAt: new Date().toISOString(), channex: null };
    return this.service.snapshot();
  }
}

@Module({
  imports: [ChannelsModule],
  controllers: [FreshnessController],
  providers: [FreshnessService, PrismaService],
})
export class FreshnessModule {}
