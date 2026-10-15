import 'reflect-metadata';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { Inject, Injectable } from '@nestjs/common';
import {
  categoryAvailability,
  failingSuites,
  latestReportResults,
  type FailingSuite,
  type ReportResult,
} from '@pms/domain';
import { telegram } from '@pms/integrations';
import { PrismaService } from '../database/prisma.provider';
import { integrationTables } from '../database/integration-tables';
import { propertyIdRef } from '../database/property-ref';
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
import { PROVIDER } from '../channels/ari-publisher';
import { isAriStopped } from '../channels/ari-switch';
import {
  CHANNELS_REPOSITORY,
  CHANNEX_GATEWAY,
  type ChannelsRepository,
  type ChannexGateway,
} from '../channels/channels.repository';
import { InboundBookingsService } from '../channels/inbound.service';
import { OutboxWorker } from '../channels/outbox.worker';
import { ChannexSyncService } from '../channels/sync.service';
import { WebhookHealthService } from '../channels/webhook-health.service';
import { readBackupStatus } from './backup-status';
import type {
  AlertNotifier,
  BackupSignal,
  FailedEvent,
  FixOutcome,
  GuardFixes,
  GuardHeartbeat,
  GuardProbes,
  HeartbeatBeat,
  OutboxSignal,
  StaySignal,
  WebhookSignal,
} from './guard.ports';

/** Корень репозитория: отсюда читаются отчёты сверок и журнал тестов. На сервере без репозитория их нет — проверки молчат. */
const ROOT = resolve(import.meta.dirname, '../../../..');
/** Те же виды, что в утреннем отчёте (`scripts/reconciliation/src/cli-morning-report.ts`) */
const REPORT_KINDS = ['inventory', 'double-entry', 'rates', 'balances', 'channex-ari'];
const execFileAsync = promisify(execFile); // без оболочки: команда и аргументы — массивом
/** Стойку держит launchd (scripts/ops/launchd/install.sh): ей и перезапускать */
const WEB_LAUNCHD_LABEL = 'kz.luxx.pms.web';
const WEB_URL = process.env.GUARD_WEB_URL ?? 'http://127.0.0.1:3000';
const WEB_TIMEOUT_MS = 10_000;
/** Остатки канала читает тот же клиент Channex, что пишет; в типе шлюза чтения нет — проверяем по факту */
interface AvailabilityReader {
  getAvailability(
    propertyId: string,
    from: string,
    to: string,
  ): Promise<Record<string, Record<string, number>>>;
}

@Injectable()
export class NestGuardProbes implements GuardProbes {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CHANNELS_REPOSITORY) private readonly channels: ChannelsRepository,
    @Inject(InboundBookingsService) private readonly inbound: InboundBookingsService,
    @Inject(WebhookHealthService) private readonly webhookHealth: WebhookHealthService,
    @Inject(CHANNEX_GATEWAY) private readonly gateway: ChannexGateway,
  ) {}

  channexEnabled(): boolean {
    return !!process.env.CHANNEX_API_KEY?.trim();
  }

  enabled(
    what: 'pull' | 'webhookHealth' | 'fullSync' | 'web' | 'ari' | 'ariOut' | 'backup',
  ): boolean {
    if (what === 'ariOut') return !isAriStopped();
    const flag = {
      pull: 'CHANNEX_PULL',
      webhookHealth: 'CHANNEX_WEBHOOK_HEALTH',
      fullSync: 'CHANNEX_FULL_SYNC',
      web: 'GUARD_WEB',
      ari: 'GUARD_ARI',
      backup: 'GUARD_BACKUP',
    }[what];
    return process.env[flag] !== 'off';
  }

  async dbPing(): Promise<void> {
    await this.prisma.db.$queryRaw`SELECT 1`;
  }

  webhook(): WebhookSignal {
    const s = this.webhookHealth.snapshot();
    return {
      checkedAt: s.checkedAt,
      suspect: s.webhookSuspect,
      suspectSince: s.suspectSince,
      suspectReason: s.suspectReason,
      callbackUrl: s.callbackProbedUrl,
      callbackReachable: s.callbackReachable,
      callbackCheckedAt: s.callbackCheckedAt,
      callbackExpectedUrl: s.callbackExpectedUrl,
    };
  }

  pullHealth() {
    return this.inbound.pullHealth();
  }

  async outbox(): Promise<OutboxSignal> {
    const lastFullSyncAt = await this.channels.lastAuditAt('channex.fullSync');
    // B1.5 (Q-222): служебная роль не различает объекты — объект в самом запросе, его выбирает сервер
    const propertyId = await propertyIdRef(this.prisma.db, LUXX_APARTS_PROPERTY.name);
    const where = {
      provider: PROVIDER,
      propertyId,
      status: 'FAILED' as const,
      ...(lastFullSyncAt ? { createdAt: { gt: lastFullSyncAt } } : {}),
    };
    const [failedSinceSync, lastFailed, summary, lostDeltaAt] = await Promise.all([
      integrationTables(this.prisma.db).channelOutbox.count({ where }),
      integrationTables(this.prisma.db).channelOutbox.findFirst({
        where,
        orderBy: { createdAt: 'desc' },
        select: { lastError: true },
      }),
      this.channels.outboxSummary(PROVIDER),
      // Дельта, не вставшая в очередь (Б6): в самой очереди её нет, след остаётся только в журнале
      this.channels.lastAuditAt('channex.deltaLost'),
    ]);
    return {
      lastFullSyncAt,
      failedSinceSync,
      lastFailedError: lastFailed?.lastError ?? null,
      oldestPendingAt: summary.oldestPendingAt ? new Date(summary.oldestPendingAt) : null,
      lostDeltaAt,
    };
  }

  async failedEvents(): Promise<FailedEvent[]> {
    const propertyId = await propertyIdRef(this.prisma.db, LUXX_APARTS_PROPERTY.name);
    const rows = await integrationTables(this.prisma.db).externalEvent.findMany({
      where: { provider: PROVIDER, propertyId, status: 'FAILED' },
      orderBy: { receivedAt: 'asc' },
      take: 50,
      select: {
        externalEventId: true,
        type: true,
        attemptCount: true,
        lastError: true,
        receivedAt: true,
      },
    });
    return rows.map((r) => ({
      externalEventId: r.externalEventId,
      type: r.type,
      attempts: r.attemptCount,
      lastError: r.lastError,
      receivedAt: r.receivedAt,
    }));
  }

  async stays(from: string, toExclusive: string): Promise<StaySignal> {
    const [units, blocks, items, unassigned, categories] = await Promise.all([
      this.channels.categoryUnits(),
      this.channels.categoryBlocks(from, toExclusive),
      this.channels.soldItems(from, toExclusive),
      // Без ячейки и с заездом в окне — стойке назначать до прихода гостя; уже живущие без ячейки видны на шахматке
      this.prisma.db.reservationItem.findMany({
        where: {
          status: { notIn: ['CANCELLED', 'NO_SHOW', 'CHECKED_OUT'] },
          arrivalDate: {
            gte: new Date(`${from}T00:00:00Z`),
            lt: new Date(`${toExclusive}T00:00:00Z`),
          },
          reservation: { property: { name: LUXX_APARTS_PROPERTY.name } },
          allocations: { none: {} },
        },
        select: {
          arrivalDate: true,
          reservation: { select: { confirmationNumber: true } },
          accommodationType: { select: { code: true } },
        },
      }),
      this.prisma.db.accommodationType.findMany({ select: { code: true, name: true } }),
    ]);
    return {
      units: units.map((u) => ({ code: u.code, active: u.active })),
      blocks,
      items,
      unassigned: unassigned.map((r) => ({
        confirmationNumber: r.reservation.confirmationNumber,
        categoryCode: r.accommodationType.code,
        arrivalDate: r.arrivalDate.toISOString().slice(0, 10),
      })),
      categoryNames: Object.fromEntries(categories.map((c) => [c.code, c.name])),
    };
  }

  reports(): ReportResult[] | null {
    const dir = resolve(ROOT, 'reports');
    if (!existsSync(dir)) return null;
    return latestReportResults(readdirSync(dir), REPORT_KINDS, (f) =>
      readFileSync(resolve(dir, f), 'utf8'),
    );
  }

  /** Архив `journal.jsonl` и записи `entries/*.json` (TESTING.md); нет ни того, ни другого, сигнала нет */
  failingSuites(): FailingSuite[] | null {
    const file = resolve(ROOT, 'tests/runs/journal.jsonl');
    const dir = resolve(ROOT, 'tests/runs/entries');
    if (!existsSync(file) && !existsSync(dir)) return null;
    const entries = existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => f.endsWith('.json'))
          .map((f) => readFileSync(resolve(dir, f), 'utf8'))
      : [];
    return failingSuites([existsSync(file) ? readFileSync(file, 'utf8') : '', ...entries].join('\n'));
  }

  /** В контейнере путь задаёт deploy/compose.yml; на Mac и в тестах его нет — копий там не снимают */
  backup(): BackupSignal | null {
    const path = process.env.GUARD_BACKUP_STATUS?.trim();
    return path ? readBackupStatus(path) : null;
  }

  /** Любой ответ сервера ниже 500 (и 404 на favicon) — стойка жива; отказ сети или молчание 10 с — нет */
  async webHealth(): Promise<{ ok: boolean; error: string | null }> {
    try {
      const res = await fetch(`${WEB_URL}/favicon.ico`, {
        redirect: 'manual',
        signal: AbortSignal.timeout(WEB_TIMEOUT_MS),
      });
      return res.status < 500
        ? { ok: true, error: null }
        : { ok: false, error: `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  async channelAvailability(from: string, to: string) {
    const reader = this.gateway as unknown as Partial<AvailabilityReader>;
    if (typeof reader.getAvailability !== 'function') return null;
    const mapped = (await this.channels.mappings(PROVIDER)).filter(
      (m) => m.providerRoomTypeId && m.localAccommodationTypeCode,
    );
    if (mapped.length === 0) return null;
    const next = new Date(`${to}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const toExclusive = next.toISOString().slice(0, 10);
    const [units, blocks, items, remote] = await Promise.all([
      this.channels.categoryUnits(),
      this.channels.categoryBlocks(from, toExclusive),
      this.channels.soldItems(from, toExclusive),
      reader.getAvailability.call(this.gateway, mapped[0]!.providerPropertyId, from, to),
    ]);
    // Отметка в журнале: по ней сторож после перезапуска API знает, что сегодня Channex уже читали (раз в сутки)
    await this.channels
      .audit('channex.availabilityRead', { from, to })
      .catch((e: unknown) =>
        console.warn(`отметка чтения остатков не записана: ${(e as Error).message}`),
      );
    const pms = categoryAvailability({ from, to, units, blocks, items });
    const channel = new Map<string, Map<string, number>>();
    for (const m of mapped) {
      const perDate = remote[m.providerRoomTypeId!];
      if (perDate) channel.set(m.localAccommodationTypeCode!, new Map(Object.entries(perDate)));
    }
    return { pms, channel };
  }

  lastAvailabilityReadAt(): Promise<Date | null> {
    return this.channels.lastAuditAt('channex.availabilityRead');
  }
}

/** Починка техники — ровно те вызовы, что делают кнопки на /channels. Ничего своего сторож в базу не пишет. */
@Injectable()
export class NestGuardFixes implements GuardFixes {
  constructor(
    @Inject(InboundBookingsService) private readonly inbound: InboundBookingsService,
    @Inject(OutboxWorker) private readonly worker: OutboxWorker,
    @Inject(ChannexSyncService) private readonly sync: ChannexSyncService,
  ) {}

  async pull(): Promise<FixOutcome> {
    const r = await this.inbound.pull();
    const failed = r.outcomes.filter((o) => o.result === 'failed').length;
    return {
      ok: true,
      text: `опрос ленты: получено ${r.received}, подтверждено ${r.acknowledged}${failed ? `, отклонено ${failed}` : ''}`,
    };
  }

  async flushOutbox(): Promise<FixOutcome> {
    const r = await this.worker.flush(true);
    const errors = r.errors.map((e) => e.error).join('; ');
    return {
      ok: r.errors.length === 0,
      text: `отправка очереди: ушло ${r.sent.reduce((n, s) => n + s.rows, 0)} изменений${errors ? `, ошибка: ${errors}` : ''}`,
    };
  }

  async fullSync(): Promise<FixOutcome> {
    const r = await this.sync.runScheduledFullSyncIfDue(new Date(), true);
    if (!r.ran) return { ok: false, text: `полная выгрузка не запущена: ${r.reason}` };
    return {
      ok: true,
      text: `полная выгрузка ${r.result?.from} → ${r.result?.to}: задачи ${r.result?.tasks.join(', ')}`,
    };
  }

  /** Зависшую стойку перезапускает её хозяин launchd; на машине без задачи — честно «не настроено», к человеку */
  async restartWeb(): Promise<FixOutcome> {
    if (process.platform !== 'darwin')
      return { ok: false, text: 'перезапуск стойки на этой машине не настроен (нет launchd)' };
    const target = `gui/${process.getuid?.() ?? 0}/${WEB_LAUNCHD_LABEL}`;
    try {
      await execFileAsync('launchctl', ['print', target]);
    } catch {
      return {
        ok: false,
        text: `стойку держит не launchd (${WEB_LAUNCHD_LABEL} не загружен) — перезапустить некому`,
      };
    }
    await execFileAsync('launchctl', ['kickstart', '-k', target]);
    return { ok: true, text: `стойка перезапущена: launchctl kickstart -k ${WEB_LAUNCHD_LABEL}` };
  }

  /**
   * Вернуть webhook Channex на постоянный адрес PMS. 15.09.2026 адрес трижды за час уезжал на одноразовые туннели
   * Cloudflare, каждый из которых умирал через минуты; чинится тем же вызовом, что кнопка «Зарегистрировать
   * webhook» на /channels, и с той же проверкой — успех считается по ответу Channex, а не по отправленному адресу.
   */
  async registerWebhook(): Promise<FixOutcome> {
    const r = await this.sync.registerWebhook();
    return { ok: true, text: `webhook менеджера каналов возвращён на ${r.callbackUrl}` };
  }

  async retryEvent(revisionId: string): Promise<FixOutcome> {
    const r = await this.inbound.retryEvent(revisionId);
    return {
      ok: r.result !== 'failed',
      text: `повтор ревизии: ${r.result}${r.confirmationNumber ? `, бронь ${r.confirmationNumber}` : ''}${r.error ? `, ошибка: ${r.error}` : ''}`,
    };
  }
}

/** Будильник: Telegram, если владелец вписал токен и чат в .env; иначе «не настроен» — сторож пишет, но не будит. */
export function notifierFromEnv(): AlertNotifier {
  const cfg = telegram.telegramConfigFromEnv(process.env);
  if (!cfg)
    return { configured: false, recipients: 0, send: async () => ({ delivered: 0, failed: [] }) };
  const client = new telegram.TelegramClient(cfg);
  return {
    configured: true,
    recipients: cfg.chatIds.length,
    send: (text) => client.sendMessage(text),
  };
}

/**
 * Сигнал на сервер «сторож сторожа» (plans/slice-12-guard-server.md, шаг 12.2). Адрес и секрет вписывает владелец в .env;
 * без них сигнал не шлётся. Только https (или локальный адрес для проверки): секрет в заголовке по открытому
 * каналу не отправляем. Секрет — в заголовке, не в адресе: адреса попадают в журналы прокси.
 */
export function heartbeatFromEnv(): GuardHeartbeat {
  const url = process.env.GUARD_HEARTBEAT_URL?.trim() ?? '';
  const secret = process.env.GUARD_HEARTBEAT_SECRET?.trim() ?? '';
  const safe = /^https:\/\//.test(url) || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url);
  if (!url || !secret || !safe) return { configured: false, send: async () => undefined };
  return {
    configured: true,
    async send(beat: HeartbeatBeat) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
        body: JSON.stringify(beat),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`сервер сторожа ответил HTTP ${res.status}`);
    },
  };
}
