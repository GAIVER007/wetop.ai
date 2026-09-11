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
  /** С какого момента webhook под подозрением (время брони, которую он не доставил) */
  since: Date | null;
  reason: string | null;
}

/**
 * Webhook под подозрением, если последнюю бронь принёс опрос ленты, а webhook её не доставил
 * (бронь опросом новее последнего webhook-события и пришла недавно). Подозрение держится, пока webhook
 * не доставит хоть одно событие после его начала — пробный вызов из Channex тоже считается.
 */
export function assessWebhook(input: {
  lastWebhookAt: Date | null;
  lastPullBookingAt: Date | null;
  now: Date;
  previous: WebhookHealth;
  windowMs?: number;
}): WebhookHealth {
  const windowMs = input.windowMs ?? WEBHOOK_MISS_WINDOW_MS;
  const { lastWebhookAt, lastPullBookingAt, now, previous } = input;
  if (previous.suspect && previous.since && lastWebhookAt && lastWebhookAt > previous.since)
    return { suspect: false, since: null, reason: null };
  const missed =
    lastPullBookingAt !== null &&
    (lastWebhookAt === null || lastPullBookingAt > lastWebhookAt) &&
    now.getTime() - lastPullBookingAt.getTime() <= windowMs;
  if (missed)
    return {
      suspect: true,
      since: previous.suspect && previous.since ? previous.since : lastPullBookingAt,
      reason: `бронь ${lastPullBookingAt!.toISOString()} пришла опросом ленты, webhook её не доставил`,
    };
  if (previous.suspect) return previous;
  return { suspect: false, since: null, reason: null };
}

/** Под подозрением ленту опрашиваем чаще, чем страховочные 5 минут */
export function pullDelayMs(input: { suspect: boolean; baseMs: number; fastMs: number }): number {
  return input.suspect ? input.fastMs : input.baseMs;
}
