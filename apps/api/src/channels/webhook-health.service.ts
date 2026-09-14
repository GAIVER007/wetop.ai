import 'reflect-metadata';
import {
  Inject,
  Injectable,
  Logger,
  Optional,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PROVIDER } from './ari-publisher';
import { CHANNELS_REPOSITORY, type ChannelsRepository } from './channels.repository';
import { InboundBookingsService } from './inbound.service';
import { assessWebhook, callbackAnswered, type WebhookHealth } from './schedule';
import { ChannexSyncService } from './sync.service';

export interface WebhookHealthSnapshot {
  webhookSuspect: boolean;
  suspectSince: string | null;
  suspectReason: string | null;
  lastWebhookAt: string | null;
  lastPullBookingAt: string | null;
  checkedAt: string | null;
  /** Адрес, который проверял сторож, и результат последней пробы: null — не проверяли */
  callbackProbedUrl: string | null;
  callbackReachable: boolean | null;
  callbackCheckedAt: string | null;
  /** Постоянный адрес PMS (PUBLIC_API_URL): зарегистрирован другой — события уходят не туда (Д4) */
  callbackExpectedUrl: string | null;
}

/** Проба адреса. Подменяется в тестах; в бою — обычный запрос. */
export type CallbackProbe = (url: string, timeoutMs: number) => Promise<boolean>;
export const CALLBACK_PROBE = Symbol('CALLBACK_PROBE');
/** Как часто дёргать Channex за адресом и проверять его: чаще незачем, страховочный опрос и так раз в 5 минут */
export const PROBE_EVERY_MS = 5 * 60_000;
export const PROBE_TIMEOUT_MS = 5_000;

/**
 * Живой адрес — это ответ нашего приложения: webhook принимает только POST, и 404 на GET означает,
 * что запрос дошёл до нас. Мёртвый — отказ сети (хост не резолвится, соединение не встаёт, ответа нет
 * за отведённое время) или ответ самого Cloudflare с кодом 5xx, когда туннель за адресом уже умер.
 */
async function httpProbe(url: string, timeoutMs: number): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return callbackAnswered(res.status, { cfMitigated: res.headers.get('cf-mitigated') });
  } catch {
    return false;
  }
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
  private callback: {
    url: string | null;
    reachable: boolean | null;
    checkedAt: Date | null;
    expectedUrl: string | null;
  } = {
    url: null,
    reachable: null,
    checkedAt: null,
    expectedUrl: null,
  };
  private readonly probe: CallbackProbe;
  constructor(
    @Inject(CHANNELS_REPOSITORY) private readonly repo: ChannelsRepository,
    @Inject(InboundBookingsService) private readonly inbound: InboundBookingsService,
    @Optional() @Inject(ChannexSyncService) private readonly sync?: ChannexSyncService,
    @Optional() @Inject(CALLBACK_PROBE) probe?: CallbackProbe,
  ) {
    this.probe = probe ?? httpProbe;
  }

  /**
   * Раз в PROBE_EVERY_MS спрашиваем у Channex зарегистрированный адрес и стучимся в него.
   * Если Channex недоступен, результат — «не проверяли»: подозрение из чужого сбоя не выдумываем.
   */
  private async probeCallback(now: Date): Promise<void> {
    if (!this.sync) return;
    const last = this.callback.checkedAt;
    if (last && now.getTime() - last.getTime() < PROBE_EVERY_MS) return;
    try {
      const status = await this.sync.webhookStatus();
      const url = status.callbackUrl ?? null;
      const expectedUrl = status.expectedUrl ?? null;
      if (!url) {
        this.callback = { url: null, reachable: null, checkedAt: now, expectedUrl };
        return;
      }
      // Д4: адрес постоянный — зарегистрирован другой (старый быстрый туннель, чужая настройка), значит события
      // Channex до PMS не доходят, даже если тот адрес отвечает. Лечится кнопкой «Зарегистрировать webhook».
      if (expectedUrl && url !== expectedUrl) {
        if (this.callback.url !== url || this.callback.reachable !== false)
          this.log.warn(
            `в Channex зарегистрирован ${url}, а постоянный адрес PMS — ${expectedUrl}: перерегистрируйте webhook на /channels`,
          );
        this.callback = { url, reachable: false, checkedAt: now, expectedUrl };
        return;
      }
      const reachable = await this.probe(url, PROBE_TIMEOUT_MS);
      if (reachable !== this.callback.reachable)
        this.log.log(`адрес webhook ${url}: ${reachable ? 'отвечает' : 'НЕ отвечает'}`);
      this.callback = { url, reachable, checkedAt: now, expectedUrl };
    } catch (e) {
      this.callback = { ...this.callback, reachable: null };
      this.log.warn(`адрес webhook не проверен: ${(e as Error).message}`);
    }
  }

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
      await this.probeCallback(now);
      const next = assessWebhook({
        lastWebhookAt,
        lastPullBookingAt,
        now,
        previous: this.state,
        callbackReachable: this.callback.reachable,
      });
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
      callbackProbedUrl: this.callback.url,
      callbackReachable: this.callback.reachable,
      callbackCheckedAt: this.callback.checkedAt?.toISOString() ?? null,
      callbackExpectedUrl: this.callback.expectedUrl,
    };
  }
}
