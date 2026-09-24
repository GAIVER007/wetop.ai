import 'reflect-metadata';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { WEB_RETENTION_MONTHS, webRetentionCutoff } from '@pms/domain';
import { ALMATY_OFFSET_HOURS, localDayAndHour } from '../channels/schedule';
import { ANALYTICS_REPOSITORY, type AnalyticsRepository } from './analytics.repository';

/** Местный час, после которого раз в сутки чистится счётчик: следом за полной выгрузкой ARI (03:00 Алматы) */
export const RETENTION_HOUR_LOCAL = 4;
/** Как часто проверяем, не пора ли (сама очистка — раз в сутки) */
const CHECK_MS = 60 * 60_000;

/** Пора ли чистить: местный час ≥ назначенного и сегодня (по местному дню) ещё не чистили. */
export function retentionDue(
  lastRunDay: string | null,
  now: Date,
  hourLocal: number = RETENTION_HOUR_LOCAL,
): boolean {
  const local = localDayAndHour(now, ALMATY_OFFSET_HOURS);
  return local.hour >= hourLocal && lastRunDay !== local.day;
}

export interface RetentionRun {
  ran: boolean;
  deleted: number;
  cutoff: string | null;
}

/**
 * Суточная очистка сырых данных счётчика сайта (проверка SECURITY.md 24.09.2026, Н12 и план П9): сессии старше
 * 13 месяцев удаляются вместе с просмотрами и событиями. До этого их удалял только ручной
 * `npm run analytics:retention`, а расписания не было — первые данные (12.09.2026) пережили бы срок в октябре 2027.
 *
 * Тем же способом, что полная выгрузка ARI (`ChannexSyncService`): таймер в процессе API. «Сегодня уже чистили»
 * помнится в памяти: после перезапуска очистка повторится, но удаление по границе от этого не меняется. В журнал
 * действий не пишет: персональных данных в сессиях счётчика нет (DATA_MODEL §11), число удалённых — в журнале API.
 */
@Injectable()
export class WebRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(WebRetentionService.name);
  private timer: NodeJS.Timeout | null = null;
  private lastRunDay: string | null = null;
  private running = false;

  constructor(@Inject(ANALYTICS_REPOSITORY) private readonly repo: AnalyticsRepository) {}

  /** В тестах и при ANALYTICS_RETENTION=off таймера нет; ручной путь остаётся — npm run analytics:retention */
  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test' || process.env.ANALYTICS_RETENTION === 'off') return;
    this.timer = setInterval(
      () =>
        void this.runIfDue().catch((e: unknown) =>
          this.log.warn(`очистка счётчика сайта не удалась: ${(e as Error).message}`),
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
      const cutoff = webRetentionCutoff(now);
      const deleted = await this.repo.deleteSessionsStartedBefore(cutoff);
      this.lastRunDay = localDayAndHour(now, ALMATY_OFFSET_HOURS).day;
      if (deleted > 0)
        this.log.log(
          `счётчик сайта: удалено сессий ${deleted}, начатых до ${cutoff.toISOString().slice(0, 10)} ` +
            `(хранение ${WEB_RETENTION_MONTHS} мес.)`,
        );
      return { ran: true, deleted, cutoff: cutoff.toISOString() };
    } finally {
      this.running = false;
    }
  }
}
