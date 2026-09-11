import 'reflect-metadata';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PROVIDER } from './ari-publisher';
import { CHANNELS_REPOSITORY, type ChannelsRepository } from './channels.repository';
import { InboundBookingsService } from './inbound.service';
import { assessWebhook, type WebhookHealth } from './schedule';

export interface WebhookHealthSnapshot {
  webhookSuspect: boolean;
  suspectSince: string | null;
  suspectReason: string | null;
  lastWebhookAt: string | null;
  lastPullBookingAt: string | null;
  checkedAt: string | null;
}

/** Раз в минуту: не пропал ли webhook. Признак — бронь пришла опросом ленты, а webhook её не доставил. */
export const HEALTH_TICK_MS = 60_000;

/**
 * Сторож webhook (plans/plan-2026-09-11-channex-hardening.md §1). Туннель до PMS трижды за день умирал молча:
 * Channex звал webhook, ответа не было, а PMS узнавала о бронях только страховочным опросом раз в 5 минут.
 * Сторож замечает это по журналу событий и, пока webhook не докажет, что жив (любое событие от Channex,
 * включая пробный вызов после перерегистрации), опрашивает ленту каждую минуту и держит предупреждение в статусе.
 */
@Injectable()
export class WebhookHealthService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(WebhookHealthService.name);
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;
  private state: WebhookHealth = { suspect: false, since: null, reason: null };
  private seen: {
    lastWebhookAt: Date | null;
    lastPullBookingAt: Date | null;
    checkedAt: Date | null;
  } = {
    lastWebhookAt: null,
    lastPullBookingAt: null,
    checkedAt: null,
  };
  constructor(
    @Inject(CHANNELS_REPOSITORY) private readonly repo: ChannelsRepository,
    @Inject(InboundBookingsService) private readonly inbound: InboundBookingsService,
  ) {}

  onModuleInit(): void {
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.CHANNEX_WEBHOOK_HEALTH === 'off' ||
      !process.env.CHANNEX_API_KEY?.trim()
    )
      return;
    this.timer = setInterval(
      () =>
        void this.tick().catch((e: unknown) =>
          this.log.warn(`сторож webhook: ${(e as Error).message}`),
        ),
      HEALTH_TICK_MS,
    );
    this.timer.unref();
  }
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now = new Date()): Promise<WebhookHealth> {
    if (this.ticking) return this.state;
    this.ticking = true;
    try {
      const [lastWebhookAt, lastPullBookingAt] = await Promise.all([
        this.repo.lastEventAt(PROVIDER, 'WEBHOOK'),
        this.repo.lastEventAt(PROVIDER, 'PULL', 'booking'),
      ]);
      const next = assessWebhook({ lastWebhookAt, lastPullBookingAt, now, previous: this.state });
      if (next.suspect && !this.state.suspect)
        this.log.warn(
          `webhook Channex под подозрением: ${next.reason}. Опрашиваю ленту каждую минуту; ` +
            'проверьте туннель/адрес (scripts/ops/channex-tunnel.sh) — после перерегистрации пробный вызов снимет подозрение',
        );
      if (!next.suspect && this.state.suspect)
        this.log.log('webhook Channex снова доставляет события — подозрение снято');
      this.state = next;
      this.seen = { lastWebhookAt, lastPullBookingAt, checkedAt: now };
      if (next.suspect) {
        const r = await this.inbound.pull();
        if (r.received > 0)
          this.log.log(
            `опрос ленты под подозрением: получено ${r.received}, подтверждено ${r.acknowledged}`,
          );
      }
      return next;
    } finally {
      this.ticking = false;
    }
  }

  snapshot(): WebhookHealthSnapshot {
    return {
      webhookSuspect: this.state.suspect,
      suspectSince: this.state.since?.toISOString() ?? null,
      suspectReason: this.state.reason,
      lastWebhookAt: this.seen.lastWebhookAt?.toISOString() ?? null,
      lastPullBookingAt: this.seen.lastPullBookingAt?.toISOString() ?? null,
      checkedAt: this.seen.checkedAt?.toISOString() ?? null,
    };
  }
}
