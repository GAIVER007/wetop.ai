/**
 * Чистые решения расписания для связки с Channex (plans/plan-2026-09-11-channex-hardening.md):
 * когда пора делать полную выгрузку ARI и когда webhook считать «под подозрением».
 * Без часов, без базы, без сети — только входные данные → ответ; проверяются тестами.
 */

/** Объект живёт по Алматы (AGENTS.md §13); сутки выгрузки считаем по местному дню. */
export const ALMATY_OFFSET_HOURS = 5;
/** Час местного времени, после которого раз в сутки делается полная выгрузка (можно сменить CHANNEX_FULL_SYNC_HOUR) */
export const DEFAULT_FULL_SYNC_HOUR = 3;
/** Бронь, пришедшая опросом ленты позже этого окна, уже не считается свежим доказательством отказа webhook */
export const WEBHOOK_MISS_WINDOW_MS = 30 * 60_000;

export function localDayAndHour(d: Date, offsetHours: number): { day: string; hour: number } {
  const shifted = new Date(d.getTime() + offsetHours * 3_600_000);
  return { day: shifted.toISOString().slice(0, 10), hour: shifted.getUTCHours() };
}

/**
 * Пора ли делать полную выгрузку: местный час ≥ назначенного и сегодня (по местному дню) её ещё не было.
 * Ручной прогон днём засчитывается — второй раз за сутки Channex не грузим.
 */
export function isFullSyncDue(input: {
  lastRunAt: Date | null;
  now: Date;
  hourLocal: number;
  offsetHours?: number;
}): boolean {
  const off = input.offsetHours ?? ALMATY_OFFSET_HOURS;
  const now = localDayAndHour(input.now, off);
  if (now.hour < input.hourLocal) return false;
  if (!input.lastRunAt) return true;
  return localDayAndHour(input.lastRunAt, off).day < now.day;
}

export interface WebhookHealth {
  suspect: boolean;
  /** С какого момента webhook под подозрением (время брони, которую он не доставил, или первой неудачной пробы) */
  since: Date | null;
  reason: string | null;
  /**
   * Почему под подозрением. Нужен для снятия: ожившый адрес снимает только своё подозрение,
   * а пропущенную бронь снимает лишь событие, дошедшее webhook'ом.
   */
  kind?: 'missed' | 'unreachable' | null;
}

/**
 * Webhook под подозрением по двум независимым признакам.
 *
 * Первый: последнюю бронь принёс опрос ленты, а webhook её не доставил (бронь опросом новее
 * последнего webhook-события и пришла недавно). Второй: зарегистрированный в Channex адрес не
 * отвечает — быстрый туннель умирает молча, и без броней первый признак не срабатывает вовсе
 * (ночь на 12.09.2026: адрес четыре часа указывал на несуществующий хост, и никто этого не видел).
 *
 * Снятие несимметрично. Событие, дошедшее webhook'ом, снимает любое подозрение: это прямое
 * доказательство, что цепочка Channex → PMS работает. Ожившый адрес снимает только подозрение по
 * адресу: то, что хост отвечает, ещё не значит, что пропущенная бронь дошла.
 *
 * `callbackReachable`: `false` — проба не прошла, `true` — адрес ответил, `null`/не задан — не проверяли.
 */
export function assessWebhook(input: {
  lastWebhookAt: Date | null;
  lastPullBookingAt: Date | null;
  now: Date;
  previous: WebhookHealth;
  windowMs?: number;
  callbackReachable?: boolean | null;
}): WebhookHealth {
  const windowMs = input.windowMs ?? WEBHOOK_MISS_WINDOW_MS;
  const { lastWebhookAt, lastPullBookingAt, now, previous } = input;
  const reachable = input.callbackReachable ?? null;
  if (previous.suspect && previous.since && lastWebhookAt && lastWebhookAt > previous.since)
    return { suspect: false, since: null, reason: null, kind: null };
  if (reachable === false)
    return {
      suspect: true,
      since: previous.suspect && previous.since ? previous.since : now,
      reason: 'зарегистрированный адрес webhook не отвечает — Channex не сможет доставить бронь',
      kind: 'unreachable',
    };
  const missed =
    lastPullBookingAt !== null &&
    (lastWebhookAt === null || lastPullBookingAt > lastWebhookAt) &&
    now.getTime() - lastPullBookingAt.getTime() <= windowMs;
  if (missed)
    return {
      suspect: true,
      since: previous.suspect && previous.since ? previous.since : lastPullBookingAt,
      reason: `бронь ${lastPullBookingAt!.toISOString()} пришла опросом ленты, webhook её не доставил`,
      kind: 'missed',
    };
  if (previous.suspect && previous.kind === 'unreachable' && reachable === true)
    return { suspect: false, since: null, reason: null, kind: null };
  if (previous.suspect) return previous;
  return { suspect: false, since: null, reason: null, kind: null };
}

/** Под подозрением ленту опрашиваем чаще, чем страховочные 5 минут */
export function pullDelayMs(input: { suspect: boolean; baseMs: number; fastMs: number }): number {
  return input.suspect ? input.fastMs : input.baseMs;
}
