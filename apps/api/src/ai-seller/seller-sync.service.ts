import 'reflect-metadata';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { SELLER_CONNECTION, type SellerConnection } from './seller.connection';
import { SellerService } from './seller.service';

/** Раз в минуту: правка цены в «Тарифах» доходит до продавца не позже чем через минуту (ТЗ §4.4) */
const TICK_MS = 60_000;

/**
 * Служба сверки с ИИ-продавцом (ТЗ ред. 1 П8): профиль новее принятого или факты объекта с другим отпечатком
 * отправляются продавцу; отказ запоминается (`last_error`) и повторяется следующей сверкой — не теряется.
 * Выключатель — `SELLER_SYNC=off`; в тестах таймера нет; без адреса и ключа продавца сверка ничего не делает.
 */
@Injectable()
export class SellerSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(SellerSyncService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private lastFailure: string | null = null;

  constructor(
    @Inject(SellerService) private readonly seller: SellerService,
    @Inject(SELLER_CONNECTION) private readonly connection: SellerConnection,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test' || !this.connection.config().syncEnabled) return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now: Date = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.seller.syncOnce(now);
      if ('failed' in result) {
        // одна запись на серию отказов, а не каждую минуту
        if (this.lastFailure !== result.failed)
          this.log.warn(`сверка с ИИ-продавцом: ${result.failed}; повтор через минуту`);
        this.lastFailure = result.failed;
      } else {
        this.lastFailure = null;
        if ('profile' in result && (result.profile || result.facts))
          this.log.log(
            `ИИ-продавцу отправлено:${result.profile ? ' профиль' : ''}${result.facts ? ' факты объекта' : ''}`,
          );
      }
    } catch (e) {
      this.log.warn(`сверка с ИИ-продавцом не прошла: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
