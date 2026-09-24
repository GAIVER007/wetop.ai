/**
 * Журнал ошибок, которые видит человек (DATA_MODEL §14, ТЗ ред. 1, П3; ADR-079). ИИ-помощник читает его, чтобы
 * ответить «что у меня сломалось»: раздел, код, текст — ровно то, что получил человек.
 *
 * В строку идут шаблон маршрута и текст ответа, который API отдал сам. Тела запроса, значений из адреса и данных
 * гостей нет по построению; текст проходит ту же маску, что неисправности (почта, телефоны, секреты).
 */

import { redactText } from '../incidents/redact';

export const USER_ERRORS_RETENTION_DAYS = 30;
const DAY_MS = 86_400_000;
const MESSAGE_MAX = 500;
/** Что отвечает Nest на необработанное исключение — его и видит человек */
const NEST_INTERNAL = 'Internal server error';

/** Разделы стойки по префиксу маршрута API: сначала частные, потом общие. Имена — как в меню стойки */
const SECTIONS: ReadonlyArray<readonly [prefix: string, section: string]> = [
  ['/hotel/onboarding', 'Настройка отеля'],
  ['/hotel/reservations', 'Брони'],
  ['/hotel/channel-report', 'Менеджер каналов'],
  ['/hotel', 'Настройки гостиницы'],
  ['/reservations', 'Брони'],
  ['/chessboard', 'Шахматка'],
  ['/availability', 'Доступность номеров'],
  ['/rates', 'Тарифы'],
  ['/rate-plans', 'Тарифы'],
  ['/guests', 'Гости'],
  ['/finance', 'Оплаты'],
  ['/desk', 'Главная'],
  ['/units', 'Номера'],
  ['/inventory', 'Номерной фонд'],
  ['/channels', 'Менеджер каналов'],
  ['/analytics', 'Аналитика'],
  ['/guard', 'Неисправности'],
  ['/audit', 'Журнал действий'],
  ['/auth', 'Вход и учётная запись'],
  ['/system', 'Система'],
  ['/ai-seller', 'ИИ-продавец'],
];

/** Маршруты помощника в журнал не пишутся: «подпись не настроена» иначе попадала бы туда на каждой странице */
const SKIPPED_PREFIX = '/assistant';

const underPrefix = (route: string, prefix: string): boolean =>
  route === prefix || route.startsWith(`${prefix}/`);

/** Раздел стойки по шаблону маршрута. Незнакомый — «Прочее», выдумывать раздел нельзя */
export function userErrorSection(route: string): string {
  for (const [prefix, section] of SECTIONS) if (underPrefix(route, prefix)) return section;
  return 'Прочее';
}

/**
 * Текст ошибки из ответа Nest: `message` строкой или списком (список — через «; », как его показывает стойка),
 * либо ответ строкой. Ничего нет — «Internal server error», как отвечает Nest на поломку. Маска и предел длины —
 * как у неисправностей.
 */
export function userErrorMessage(response: unknown): string {
  let text: string | null = null;
  if (typeof response === 'string') text = response;
  else if (response && typeof response === 'object' && 'message' in response) {
    const message = (response as { message?: unknown }).message;
    if (typeof message === 'string') text = message;
    else if (Array.isArray(message))
      text = message.filter((m): m is string => typeof m === 'string').join('; ');
  }
  return redactText(text && text.trim() !== '' ? text : NEST_INTERNAL, MESSAGE_MAX);
}

/** Пишется ли ответ в журнал: 4xx и 5xx на известном маршруте, кроме маршрутов самого помощника */
export function isUserErrorRecorded(status: number, route: string): boolean {
  if (!Number.isInteger(status) || status < 400 || status > 599) return false;
  if (route === '') return false;
  return !underPrefix(route, SKIPPED_PREFIX);
}

/** Граница хранения: строки старше неё уборка удаляет */
export function userErrorsCutoff(now: Date): Date {
  return new Date(now.getTime() - USER_ERRORS_RETENTION_DAYS * DAY_MS);
}

export interface UserErrorKey {
  userId: string;
  method: string;
  route: string;
  status: number;
  message: string;
}

/**
 * Одна и та же ошибка того же человека на том же маршруте чаще раза в окно (минута) не дублируется: фоновый опрос
 * стойки (ADR-062), упёршийся в отказ, иначе заполнил бы журнал одной строкой сотни раз. Память ограничена:
 * лишние старые отметки вычищаются.
 */
export class UserErrorDedupe {
  private readonly seen = new Map<string, number>();

  constructor(
    private readonly windowMs = 60_000,
    private readonly maxEntries = 5_000,
  ) {}

  get size(): number {
    return this.seen.size;
  }

  /** `true` — ошибку пора писать; отметка ставится сразу */
  firstSeen(key: UserErrorKey, nowMs: number): boolean {
    const id = [key.userId, key.method, key.route, key.status, key.message].join('\u0000');
    const last = this.seen.get(id);
    if (last !== undefined && nowMs - last < this.windowMs) return false;
    this.seen.delete(id);
    this.seen.set(id, nowMs);
    if (this.seen.size > this.maxEntries) this.prune(nowMs);
    return true;
  }

  private prune(nowMs: number): void {
    for (const [id, at] of this.seen) if (nowMs - at >= this.windowMs) this.seen.delete(id);
    // все отметки свежие, а предел превышен — уходят самые старые (Map хранит порядок вставки)
    while (this.seen.size > this.maxEntries) {
      const oldest = this.seen.keys().next().value;
      if (oldest === undefined) break;
      this.seen.delete(oldest);
    }
  }
}
