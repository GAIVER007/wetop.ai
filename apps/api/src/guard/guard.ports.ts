import type {
  BackupStatus,
  FailingSuite,
  IncidentKind,
  Observation,
  ReportResult,
} from '@pms/domain';

/** Что сторож читает о системе. В бою — `guard.probes.ts`, в тестах — подделка. */
export const GUARD_PROBES = Symbol('GUARD_PROBES');
/** Чем сторож чинит технику: только те пути, что уже есть кнопками на /channels. */
export const GUARD_FIXES = Symbol('GUARD_FIXES');
/** Будильник. В бою — Telegram, если владелец вписал токен и чат (docs/telegram/README.md). */
export const ALERT_NOTIFIER = Symbol('ALERT_NOTIFIER');
/** Сигнал «я жив» на сервер «сторож сторожа» (plans/slice-12-guard-server.md). Без GUARD_HEARTBEAT_URL — выключен. */
export const GUARD_HEARTBEAT = Symbol('GUARD_HEARTBEAT');

/** Только числа: сервер стоит не в РК, заголовков неисправностей и номеров броней в сигнале нет (ADR-018) */
export interface HeartbeatBeat {
  at: string;
  open: number;
  critical: number;
  escalated: number;
  checksFailed: number;
}

export interface GuardHeartbeat {
  readonly configured: boolean;
  send(beat: HeartbeatBeat): Promise<void>;
}

export interface WebhookSignal {
  checkedAt: string | null;
  suspect: boolean;
  suspectSince: string | null;
  suspectReason: string | null;
  callbackUrl: string | null;
  callbackReachable: boolean | null;
  callbackCheckedAt: string | null;
  /** Постоянный адрес PMS (PUBLIC_API_URL). Зарегистрирован другой — события Channex уходят мимо (Д4) */
  callbackExpectedUrl: string | null;
}

export interface OutboxSignal {
  lastFullSyncAt: Date | null;
  /** FAILED-дельты, поставленные после последней успешной полной выгрузки — только их выгрузка ещё не перекрыла */
  failedSinceSync: number;
  lastFailedError: string | null;
  oldestPendingAt: Date | null;
  /** Когда дельта не встала в очередь после записанной команды (журнал `channex.deltaLost`, Б6) */
  lostDeltaAt: Date | null;
}

export interface FailedEvent {
  externalEventId: string;
  type: string;
  attempts: number;
  lastError: string | null;
  receivedAt: Date;
}

export interface StaySignal {
  units: Array<{ code: string; active: number }>;
  blocks: Array<{ accommodationTypeCode: string; dateFrom: string; dateTo: string }>;
  items: Array<{ accommodationTypeCode: string; arrivalDate: string; departureDate: string }>;
  unassigned: Array<{ confirmationNumber: string; categoryCode: string; arrivalDate: string }>;
  categoryNames: Record<string, string>;
}

/**
 * Статус ночной копии базы (ADR-077).
 * - `ok` — последняя удачная копия;
 * - `missing` — файла статуса нет: cron копию этим скриптом не снимал или папка статуса не смонтирована;
 * - `unreadable` — файл есть, но не читается (права, мусор); `error` — код ошибки или «не статус копии».
 */
export type BackupSignal =
  | { state: 'ok'; status: BackupStatus }
  | { state: 'missing' }
  | { state: 'unreadable'; error: string };

export interface GuardProbes {
  /** Фоновые части Channex работают только с ключом (как у outbox/опроса/сторожа webhook) */
  channexEnabled(): boolean;
  /** Выключатели фоновых задач из .env: проверять то, что выключено, — плодить ложные неисправности */
  /** ariOut — исходящий ARI не остановлен выключателем CHANNEX_ARI (Q-126) */
  enabled(
    what: 'pull' | 'webhookHealth' | 'fullSync' | 'web' | 'ari' | 'ariOut' | 'backup',
  ): boolean;
  dbPing(): Promise<void>;
  webhook(): WebhookSignal;
  pullHealth(): { startedAt: Date; okAt: Date | null; failedAt: Date | null; error: string | null };
  outbox(): Promise<OutboxSignal>;
  failedEvents(): Promise<FailedEvent[]>;
  stays(from: string, toExclusive: string): Promise<StaySignal>;
  /**
   * Отчёты сверок и журнал тестов читаются с диска рядом с кодом. В контейнере это СЛЕПОК на момент
   * сборки образа, поэтому сторож судит по возрасту данных (`reportIsFresh`, `suiteRunIsFresh`),
   * а не по выключателю в окружении (разбор 21.09.2026). null — папки отчётов нет: проверка не выполнялась
   */
  reports(): ReportResult[] | null;
  /** null — журнала тестов нет */
  failingSuites(): FailingSuite[] | null;
  /**
   * Статус ночной копии базы (ADR-077): файл, который пишет `scripts/ops/db-backup.sh` на хосте; в контейнер API
   * смонтирована только его папка. null — проверка не настроена (нет GUARD_BACKUP_STATUS: Mac, тесты).
   */
  backup(): BackupSignal | null;
  /** Стойка отвечает? Лёгкий статический адрес, чтобы не путать зависание с медленной сборкой страницы */
  webHealth(): Promise<{ ok: boolean; error: string | null }>;
  /**
   * Остаток на ночь по категориям: как его считает PMS для каналов и как его видит канал. null — сверить нечем
   * (нет маппинга или шлюз не умеет читать остатки).
   */
  channelAvailability(
    from: string,
    to: string,
  ): Promise<{
    pms: Map<string, Map<string, number>>;
    channel: Map<string, Map<string, number>>;
  } | null>;
}

export interface FixOutcome {
  ok: boolean;
  text: string;
}

export interface GuardFixes {
  pull(): Promise<FixOutcome>;
  flushOutbox(): Promise<FixOutcome>;
  fullSync(): Promise<FixOutcome>;
  retryEvent(revisionId: string): Promise<FixOutcome>;
  /** Перезапуск зависшей стойки тем, кто её держит (launchd на Mac); где некому — честное «не настроено» */
  restartWeb(): Promise<FixOutcome>;
  /** Вернуть webhook Channex на постоянный адрес PMS — то же, что кнопка «Зарегистрировать webhook» на /channels */
  registerWebhook(): Promise<FixOutcome>;
}

export interface AlertNotifier {
  readonly configured: boolean;
  readonly recipients: number;
  send(
    text: string,
  ): Promise<{ delivered: number; failed: Array<{ chatId: string; error: string }> }>;
}

export interface GuardTickSummary {
  at: string;
  durationMs: number;
  dbOk: boolean;
  checked: IncidentKind[];
  checkErrors: Array<{ check: string; error: string }>;
  observed: Observation[];
  resolved: number;
  fixes: Array<{ kind: IncidentKind; subjectId: string | null; ok: boolean; text: string }>;
  escalated: number;
  alerted: number;
  alertError: string | null;
  /** Сигнал на сервер сторожа не ушёл: причина */
  heartbeatError?: string;
}
