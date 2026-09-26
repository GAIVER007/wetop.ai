import 'reflect-metadata';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { USER_ERRORS_RETENTION_DAYS, userErrorsCutoff } from '@pms/domain';
import { retentionDue, type RetentionRun } from '../analytics/retention.service';
import { ALMATY_OFFSET_HOURS, localDayAndHour } from '../channels/schedule';
import { USER_ERRORS_REPOSITORY, type UserErrorsRepository } from './user-errors.repository';

/** Как часто проверяем, не пора ли (сама уборка — раз в сутки после 04:00 Алматы) */
const CHECK_MS = 60 * 60_000;

/**
 * Уборка журнала ошибок человека (DATA_MODEL §14): строки старше 30 суток удаляются раз в сутки после 04:00
 * Алматы — тем же способом, что уборка счётчика сайта (`WebRetentionService`). Выключатель —
 * `USER_ERRORS_RETENTION=off`; в тестах таймера нет.
 */
@Injectable()
export class UserErrorsRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(UserErrorsRetentionService.name);
  private timer: NodeJS.Timeout | null = null;
  private lastRunDay: string | null = null;
  private running = false;

  constructor(@Inject(USER_ERRORS_REPOSITORY) private readonly repo: UserErrorsRepository) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test' || process.env.USER_ERRORS_RETENTION === 'off') return;
    this.timer = setInterval(
      () =>
        void this.runIfDue().catch((e: unknown) =>
          this.log.warn(`уборка журнала ошибок не удалась: ${(e as Error).message}`),
        ),
      CHECK_MS,
    );
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runIfDue(now: Date = new Date()): Promise<RetentionRun> {
    if (this.running || !retentionDue(this.lastRunDay, now))
      return { ran: false, deleted: 0, cutoff: null };
    this.running = true;
    try {
      const cutoff = userErrorsCutoff(now);
      const deleted = await this.repo.deleteBefore(cutoff);
      this.lastRunDay = localDayAndHour(now, ALMATY_OFFSET_HOURS).day;
      if (deleted > 0)
        this.log.log(
          `журнал ошибок: удалено строк ${deleted} старше ${USER_ERRORS_RETENTION_DAYS} суток`,
        );
      return { ran: true, deleted, cutoff: cutoff.toISOString() };
    } finally {
      this.running = false;
    }
  }
}
