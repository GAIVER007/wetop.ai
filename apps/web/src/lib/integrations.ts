import type { ChannelConnection, ChannelMappingRow, OutboxSummary, WebhookStatus } from './api';
import type { PropertyClock } from './property-time';

/**
 * «Интеграции» (INT1, ADR-116): состояние внешнего подключения по настоящим сигналам, а не зелёным по умолчанию.
 * Сигналы Channex — те, что API уже отдаёт: живая проверка объекта (`/channels/channex/connection`), webhook и
 * сводка очереди. Порог застоя очереди — тот же, что у «Каналов продаж» (10 минут).
 */
export type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

export const settle = <T>(p: Promise<T>): Promise<Settled<T>> =>
  p.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );

/** ok — работает; attention — есть что исправить; unknown — проверить не удалось; off — не подключено */
export type IntegrationHealth = 'ok' | 'attention' | 'unknown' | 'off';

export const HEALTH_LABEL: Record<IntegrationHealth, string> = {
  ok: 'Работает',
  attention: 'Требует внимания',
  unknown: 'Состояние неизвестно',
  off: 'Не подключено',
};

export const HEALTH_TONE: Record<IntegrationHealth, 'ok' | 'warn' | 'neutral'> = {
  ok: 'ok',
  attention: 'warn',
  unknown: 'neutral',
  off: 'neutral',
};

/** Причина словами и, если есть, ссылка прямо туда, где её исправляют */
export interface HealthIssue {
  text: string;
  href?: string;
  action?: string;
}

export interface ChannexCard {
  health: IntegrationHealth;
  issues: HealthIssue[];
  connection: ChannelConnection | null;
  webhook: WebhookStatus | null;
  /** Сводка очереди в каналы: время последней отправки — для технических деталей страницы Channex */
  outbox: OutboxSummary | null;
  lastExchangeAt: string | null;
}

/** Сколько категорий объекта сопоставлено с Channex (INT2, ADR-121): «N из M» и названия пропущенных */
export interface CategoryCoverage {
  mapped: number;
  total: number;
  missing: string[];
}

/**
 * Категория сопоставлена, если хотя бы у одной строки сопоставления с её кодом есть категория в Channex; строка объекта
 * (без кода категории) не считается. Все категории — из сводки фонда. Знаменатель у тарифов не считаем: тариф
 * сопоставляется парой «категория × тариф», а тарифы без продаж сопоставлять не нужно.
 */
export function categoryCoverage(
  mapping: ChannelMappingRow[],
  categories: Array<{ code: string; name: string }>,
): CategoryCoverage {
  const mappedCodes = new Set(
    mapping
      .filter((m) => m.localAccommodationTypeCode && m.providerRoomTypeId)
      .map((m) => m.localAccommodationTypeCode),
  );
  const missing = categories.filter((c) => !mappedCodes.has(c.code)).map((c) => c.name);
  return { mapped: categories.length - missing.length, total: categories.length, missing };
}

export const STALL_MINUTES = 10;
const CHANNELS = '/channels';

const statusOf = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  typeof error.status === 'number'
    ? error.status
    : undefined;

const latest = (...moments: Array<string | null | undefined>) =>
  moments
    .filter((m): m is string => !!m && Number.isFinite(Date.parse(m)))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;

export function channexCard(input: {
  connection: Settled<ChannelConnection>;
  webhook: Settled<WebhookStatus>;
  outbox: Settled<OutboxSummary>;
  /** Сопоставление категорий; не загрузилось — остаётся прежнее правило «ни одной категории» */
  coverage?: CategoryCoverage | null;
  now: Date;
}): ChannexCard {
  const webhook = input.webhook.ok ? input.webhook.value : null;
  const outbox = input.outbox.ok ? input.outbox.value : null;
  if (!input.connection.ok) {
    // 403 — интеграция установки подключена к объекту другой организации (ADR-095): для этой — не подключено
    if (statusOf(input.connection.error) === 403)
      return {
        health: 'off',
        issues: [],
        connection: null,
        webhook: null,
        outbox: null,
        lastExchangeAt: null,
      };
    return {
      health: 'unknown',
      issues: [{ text: 'Не удалось проверить Channex. Повторите проверку.' }],
      connection: null,
      webhook,
      outbox,
      lastExchangeAt: null,
    };
  }
  const connection = input.connection.value;
  const lastExchangeAt = latest(
    connection.lastWebhookAt,
    connection.lastPullAt,
    outbox?.lastSentAt,
  );
  const base = { connection, webhook, outbox, lastExchangeAt };
  if (connection.state === 'NO_KEY') return { ...base, health: 'off', issues: [] };

  const problems: HealthIssue[] = [];
  const unknowns: HealthIssue[] = [];
  if (connection.state === 'NO_MAPPING') {
    problems.push({
      text: 'Объект в Channex не создан',
      href: `${CHANNELS}/connections`,
      action: 'Открыть настройку',
    });
  } else if (connection.state !== 'READY') {
    problems.push({ text: connection.message });
  } else if (connection.mappedCategories === 0) {
    problems.push({
      text: 'Категории не сопоставлены',
      href: `${CHANNELS}/mapping`,
      action: 'Открыть сопоставление',
    });
  } else if (
    input.coverage &&
    input.coverage.mapped > 0 &&
    input.coverage.mapped < input.coverage.total
  ) {
    // «ни одной» решает счётчик самого API: он и сопоставление читаются из одних строк
    // «mapping incomplete» из ТЗ INT1 §14: непроданная в каналах категория — то, что владелец должен увидеть
    problems.push({
      text: `Не сопоставлено категорий: ${input.coverage.total - input.coverage.mapped} из ${input.coverage.total}`,
      href: `${CHANNELS}/mapping`,
      action: 'Открыть сопоставление',
    });
  }
  if (!webhook) unknowns.push({ text: 'Не удалось проверить webhook' });
  else if (!webhook.registered || !webhook.active)
    problems.push({
      text: 'Webhook не включён',
      href: `${CHANNELS}/connections`,
      action: 'Открыть настройку',
    });
  else if (webhook.callbackReachable === false) problems.push({ text: 'Webhook не отвечает' });
  if (!outbox) unknowns.push({ text: 'Не удалось проверить очередь в каналы' });
  else {
    const stalled = outbox.oldestPendingAt
      ? Math.floor((input.now.getTime() - Date.parse(outbox.oldestPendingAt)) / 60_000)
      : 0;
    if (outbox.failed > 0)
      problems.push({
        text: `Ошибок отправки в каналы: ${outbox.failed}`,
        href: `${CHANNELS}/sync?queue=FAILED`,
        action: 'Открыть очередь',
      });
    else if (outbox.pending > 0 && stalled >= STALL_MINUTES)
      problems.push({
        text: `Очередь в каналы стоит ${stalled} мин`,
        href: `${CHANNELS}/sync?queue=PENDING`,
        action: 'Открыть очередь',
      });
  }
  if (problems.length) return { ...base, health: 'attention', issues: problems };
  if (unknowns.length) return { ...base, health: 'unknown', issues: unknowns };
  return { ...base, health: 'ok', issues: [] };
}

/** «2 мин назад», «сегодня, 19:46», «вчера, 19:46», раньше — «20.09 в 16:50»; события не было — «—» */
export function exchangeLine(iso: string | null, clock: PropertyClock, now: Date): string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return '—';
  const minutes = Math.floor((now.getTime() - Date.parse(iso)) / 60_000);
  if (minutes >= 0 && minutes < 1) return 'только что';
  if (minutes >= 1 && minutes < 60) return `${minutes} мин назад`;
  const day = clock.date(iso);
  const today = clock.today(now);
  const yesterday = clock.date(
    new Date(Date.parse(`${today}T12:00:00Z`) - 86_400_000).toISOString(),
  );
  if (day === today) return `сегодня, ${clock.clock(iso)}`;
  if (day === yesterday) return `вчера, ${clock.clock(iso)}`;
  return clock.when(iso);
}
