import 'reflect-metadata';
import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PROVIDER } from './ari-publisher';
import {
  CHANNELS_REPOSITORY,
  CHANNEX_GATEWAY,
  type ChannelsRepository,
  type ChannexGateway,
  type OutboxKind,
} from './channels.repository';

export interface FlushResult {
  sent: Array<{ kind: OutboxKind; rows: number; values: number; taskId: string | null }>;
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
  constructor(
    @Inject(CHANNEX_GATEWAY) private readonly gateway: ChannexGateway,
    @Inject(CHANNELS_REPOSITORY) private readonly repo: ChannelsRepository,
  ) {}
  /** Часы — подменяются в тестах */
  now: () => number = () => Date.now();

  /** Фоновый цикл только в живом процессе с ключом; в тестах (NODE_ENV=test) и без ключа — выключен. */
  onModuleInit(): void {
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.CHANNEX_OUTBOX_WORKER === 'off' ||
      !process.env.CHANNEX_API_KEY?.trim()
    )
      return;
    this.timer = setInterval(() => void this.flush().catch(() => undefined), 5_000);
    this.timer.unref();
  }
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Один проход: на каждый вид — все PENDING в один вызов Channex (last-win FIFO), с троттлингом и backoff. */
  async flush(force = false): Promise<FlushResult> {
    const result: FlushResult = { sent: [], skipped: [], errors: [] };
    if (this.running) return result;
    this.running = true;
    try {
      for (const kind of ['AVAILABILITY', 'RESTRICTIONS'] as const) {
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
          await this.repo.markOutboxSent(
            rows.map((r) => r.id),
            taskId,
          );
          this.lastSentAt[kind] = this.now();
          result.sent.push({ kind, rows: rows.length, values: values.length, taskId });
        } catch (e) {
          const attempts = Math.max(...rows.map((r) => r.attempts)) + 1;
          const retryAt = new Date(this.now() + backoffMs(attempts));
          const message = e instanceof Error ? e.message : String(e);
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
