import 'reflect-metadata';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ExtensionsService } from '../platform/extensions.service';
import { SELLER_CONNECTION, type SellerConnection } from './seller.connection';
import { SellerService } from './seller.service';

/** Раз в минуту: правка цены в «Тарифах» доходит до продавца не позже чем через минуту (ТЗ §4.4) */
const TICK_MS = 60_000;

/**
 * Служба сверки с ИИ-продавцом (ТЗ ред. 1 П8): профиль новее принятого или факты объекта с другим отпечатком
 * отправляются продавцу; отказ запоминается (`last_error`) и повторяется следующей сверкой — не теряется. Кроме отказа
 * по содержанию (400, 422): ту же версию продавец отклонит снова — её шлёт «Применить» или следующая правка.
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
    @Inject(ExtensionsService) private readonly extensions: ExtensionsService,
  ) {}

  onModuleInit(): void {
    // Смена расширения — гостиница уходит продавцу сразу, лучшим усилием (Э4); сверка догонит.
    // Регистрируется и при SELLER_SYNC=off: выключена сверка по расписанию, а не раздел.
    this.extensions.onAiSellerChange((organizationId) => {
      void this.seller
        .pushOrganization(organizationId)
        .then((sent) => {
          if (!sent) this.log.warn('смена расширения: гостиница до продавца не дошла, сверка догонит');
        });
    });
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
      if ('skipped' in result) return;
      if (result.failed.length > 0) {
        // одна запись на серию одинаковых отказов, а не каждую минуту
        const failure = result.failed.join('; ');
        if (this.lastFailure !== failure)
          this.log.warn(`сверка с ИИ-продавцом: ${failure}; отказ по содержанию сверка не повторяет — ждём правки или «Применить»`);
        this.lastFailure = failure;
      } else {
        this.lastFailure = null;
      }
      if (result.profile > 0 || result.facts > 0)
        this.log.log(
          `ИИ-продавцу отправлено: профиль — ${result.profile}, факты — ${result.facts} (гостиниц: ${result.organizations})`,
        );
    } catch (e) {
      this.log.warn(`сверка с ИИ-продавцом не прошла: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
