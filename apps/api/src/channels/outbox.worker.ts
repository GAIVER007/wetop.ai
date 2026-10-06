import 'reflect-metadata';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { redactText } from '@pms/domain';
import { PROVIDER } from './ari-publisher';
import { ARI_STOPPED_MESSAGE, isAriStopped } from './ari-switch';
import { withIntegrationPropertyScope } from '../auth/request-context';
import {
  CHANNELS_REPOSITORY,
  CHANNEX_GATEWAY,
  type ChannelsRepository,
  type ChannexGateway,
  type OutboxKind,
} from './channels.repository';

export interface FlushResult {
  sent: Array<{
    kind: OutboxKind;
    rows: number;
    values: number;
    taskId: string | null;
    /** Сколько значений Channex отклонил предупреждением в ответе 200; поля нет, если ни одного */
    warnings?: number;
  }>;
  skipped: Array<{ kind: OutboxKind; reason: string }>;
  errors: Array<{ kind: OutboxKind; error: string; retryAt: string }>;
}

/** rate-limits.md: 10 запросов/мин на эндпоинт → не чаще одного раза в 6 с на вид; батчим всё, что накопилось. */
export const MIN_INTERVAL_MS = 6_000;
const MAX_ATTEMPTS = 6;
const backoffMs = (attempts: number) => Math.min(60_000 * 2 ** attempts, 6 * 3_600_000);

@Injectable()
export class OutboxWorker implements OnModuleInit, OnModuleDestroy {
  private lastSentAt: Record<OutboxKind, number> = { AVAILABILITY: 0, RESTRICTIONS: 0 };
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private scanning = false;
  private nextPropertyIndex = 0;
  constructor(
    @Inject(CHANNEX_GATEWAY) private readonly gateway: ChannexGateway,
    @Inject(CHANNELS_REPOSITORY) private readonly repo: ChannelsRepository,
  ) {}
  /** Часы — подменяются в тестах */
  now: () => number = () => Date.now();

  /** Фоновый цикл только в живом процессе с ключом; в тестах (NODE_ENV=test) и без ключа — выключен. */
  onModuleInit(): void {
    // Про остановленный ARI должно быть видно сразу в журнале API, а не через 15 минут по тревоге сторожа
    if (isAriStopped()) new Logger(OutboxWorker.name).warn(ARI_STOPPED_MESSAGE);
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.CHANNEX_OUTBOX_WORKER === 'off' ||
      !process.env.CHANNEX_API_KEY?.trim()
    )
      return;
    this.timer = setInterval(
      () =>
        void this.flushConnectedProperties().catch((e: unknown) =>
          new Logger(OutboxWorker.name).warn(`Очередь менеджера каналов: ${(e as Error).message}`),
        ),
      5_000,
    );
    this.timer.unref();
  }
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Each connected property owns its own outbox; never read a tenant through a default property. */
  private async flushConnectedProperties(): Promise<void> {
    if (this.scanning) return;
    this.scanning = true;
    try {
      const mappings = await this.repo.connectedProperties();
      const start = this.nextPropertyIndex % Math.max(1, mappings.length);
      for (let offset = 0; offset < mappings.length; offset += 1) {
        const index = (start + offset) % mappings.length;
        const mapping = mappings[index]!;
        try {
          const result = await withIntegrationPropertyScope(mapping.localPropertyId, () => this.flush());
          // Keep the next branch first until throttling allows a send, rather than always serving branch one.
          if (result.sent.length > 0) this.nextPropertyIndex = (index + 1) % mappings.length;
        } catch (e) {
          new Logger(OutboxWorker.name).warn(
            `Очередь объекта ${mapping.localPropertyId}: ${redactText((e as Error).message, 1000)}`,
          );
        }
      }
    } finally {
      this.scanning = false;
    }
  }

  /** Один проход: на каждый вид — все PENDING в один вызов Channex (last-win FIFO), с троттлингом и backoff. */
  async flush(force = false): Promise<FlushResult> {
    const result: FlushResult = { sent: [], skipped: [], errors: [] };
    if (this.running) return result;
    this.running = true;
    try {
      for (const kind of ['AVAILABILITY', 'RESTRICTIONS'] as const) {
        // Выключатель ARI (Q-126): даже принудительная отправка ничего не шлёт и не тратит попытки — строки ждут включения
        if (isAriStopped()) {
          result.skipped.push({ kind, reason: 'ari-stopped' });
          continue;
        }
        const nowMs = this.now();
        if (!force && nowMs - this.lastSentAt[kind] < MIN_INTERVAL_MS) {
          result.skipped.push({ kind, reason: 'throttled' });
          continue;
        }
        const rows = await this.repo.pendingOutbox(PROVIDER, kind, new Date(nowMs));
        if (rows.length === 0) continue;
        const values = rows.flatMap((r) => r.payload);
        try {
          const res =
            kind === 'AVAILABILITY'
              ? await this.gateway.updateAvailability(values as never)
              : await this.gateway.updateRestrictions(values as never);
          const taskId = res.data[0]?.id ?? null;
          // ari.md «Warning Notifications»: неверные значения Channex выбрасывает и отвечает 200 — не молчать (Б4)
          const warnings = Array.isArray(res.meta?.warnings) ? res.meta.warnings : [];
          // SECURITY.md §7: в last_error очереди — без контактов и секретов, даже если Channex их повторит
          const warning = warnings.length
            ? redactText(
                `Менеджер каналов отклонил значений: ${warnings.length} — ${JSON.stringify(warnings)}`,
                2000,
              )
            : null;
          if (warning) new Logger(OutboxWorker.name).error(warning.slice(0, 2000));
          await this.repo.markOutboxSent(
            rows.map((r) => r.id),
            taskId,
            warning,
          );
          this.lastSentAt[kind] = this.now();
          result.sent.push({
            kind,
            rows: rows.length,
            values: values.length,
            taskId,
            ...(warnings.length ? { warnings: warnings.length } : {}),
          });
        } catch (e) {
          const attempts = Math.max(...rows.map((r) => r.attempts)) + 1;
          const retryAt = new Date(this.now() + backoffMs(attempts));
          const message = redactText(e instanceof Error ? e.message : String(e), 1000);
          await this.repo.markOutboxRetry(
            rows.map((r) => r.id),
            message,
            retryAt,
            attempts >= MAX_ATTEMPTS,
          );
          result.errors.push({ kind, error: message, retryAt: retryAt.toISOString() });
        }
      }
    } finally {
      this.running = false;
    }
    return result;
  }
}
