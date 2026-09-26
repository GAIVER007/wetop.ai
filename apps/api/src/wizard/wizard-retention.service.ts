import 'reflect-metadata';
import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';

/** Как часто проверяем: гостевая сессия истекает за минуты-часы, не за сутки — уборка чаще, чем у суточных наборов */
const CHECK_MS = 60 * 60_000;

/**
 * Уборка гостевых сессий мастера (проверка слияния 26.09): без неё истёкшая сессия, черновик и события оставались в
 * базе навсегда — публичная форма без входа растила бы её без предела. `WizardDraft`/`WizardEvent` каскадно уходят
 * вместе со своей `WizardSession` (schema.prisma); уже привязанный к организации черновик (`agentId` задан) хранит
 * настройки в `SellerAgent` — гостевую запись можно снять тем же способом.
 */
@Injectable()
export class WizardRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(WizardRetentionService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** В тестах и при WIZARD_RETENTION=off таймера нет */
  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test' || process.env.WIZARD_RETENTION === 'off') return;
    this.timer = setInterval(
      () =>
        void this.purgeExpired().catch((e: unknown) =>
          this.log.warn(`уборка сессий мастера не удалась: ${(e as Error).message}`),
        ),
      CHECK_MS,
    );
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async purgeExpired(now: Date = new Date()): Promise<number> {
    const { count } = await this.prisma.db.wizardSession.deleteMany({
      where: { expiresAt: { lte: now } },
    });
    if (count > 0) this.log.log(`мастер: удалено истёкших сессий ${count}`);
    return count;
  }
}
