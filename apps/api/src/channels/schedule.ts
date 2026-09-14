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

/**
 * Дошёл ли запрос до нашего API, по коду ответа на пробу адреса webhook.
 *
 * Код ниже 500 отдаёт наше приложение: на GET по пути webhook это 404, и он означает, что адрес жив.
 * Коды 5xx на быстром туннеле отдаёт сам Cloudflare, когда до приложения запрос не дошёл: 530 — туннель
 * за адресом мёртв (ошибка 1033), 502–504 и 520–527 — источник не отвечает. Проверено 13.09.2026:
 * старый адрес после перезапуска туннеля отвечал 530, пока DNS-запись ещё не удалена. Раньше правило
 * считало живым любой ответ и такой адрес пропускало — ровно тот случай, ради которого проба делалась.
 */
export function callbackAnswered(status: number, extra?: { cfMitigated?: string | null }): boolean {
  // Д4: на постоянном адресе за Cloudflare 3xx — это вход Access, а 403 с cf-mitigated — проверка на бота:
  // POST от Channex туда не пройдёт, значит и «жив» такой ответ не считается. Наше приложение на GET отвечает 404.
  if (status >= 300 && status < 400) return false;
  if (status === 403 && extra?.cfMitigated) return false;
  return status > 0 && status < 500;
}

/**
 * Результат пробы говорит о зарегистрированном адресе, только если пробовали именно его.
 *
 * Сторож спрашивает адрес у Channex раз в пять минут, а туннель перезапускается когда угодно и сразу
 * перерегистрирует webhook. 13.09.2026 так и вышло: проба в 12:21:23 застала старый адрес живым, через
 * десять секунд в Channex стоял уже новый, а старый отвечал 530. Статус показывал бы «отвечает» рядом с
 * чужим адресом — поэтому до следующей пробы результат для нового адреса неизвестен.
 */
export function reachabilityForRegistered(input: {
  registeredUrl: string | null;
  probedUrl: string | null;
  reachable: boolean | null;
}): boolean | null {
  if (!input.registeredUrl || !input.probedUrl) return null;
  return input.registeredUrl === input.probedUrl ? input.reachable : null;
}

/** Под подозрением ленту опрашиваем чаще, чем страховочные 5 минут */
export function pullDelayMs(input: { suspect: boolean; baseMs: number; fastMs: number }): number {
  return input.suspect ? input.fastMs : input.baseMs;
}
