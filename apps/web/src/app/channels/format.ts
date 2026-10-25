import type { PropertyClock } from '../../lib/property-time';
import { countLabel, msg, translator, type DeskLocale, type Translate } from '../../i18n';

/** Время события по часам объекта с датой: `14.09 09:10` — DESIGN.md §14; пояс — объекта (С-13) */
export function eventTime(iso: string | null | undefined, clock: PropertyClock): string {
  if (!iso) return '—';
  if (!Number.isFinite(Date.parse(iso))) return iso;
  return clock.moment(iso);
}
/** Полная дата и время события по часам объекта: `14.09.2026 09:10` */
export function eventTimeFull(iso: string | null | undefined, clock: PropertyClock): string {
  if (!iso) return '—';
  if (!Number.isFinite(Date.parse(iso))) return iso;
  return clock.full(iso);
}
export const EVENT_STATUS_RU: Record<string, string> = {
  PROCESSED: msg('обработано'),
  FAILED: msg('ошибка'),
  RECEIVED: msg('получено'),
  PROCESSING: msg('в работе'),
};
export const EVENT_STATUS_TONE: Record<string, 'ok' | 'danger' | 'info'> = {
  PROCESSED: 'ok',
  FAILED: 'danger',
  RECEIVED: 'info',
  PROCESSING: 'info',
};
export const VIA_RU: Record<string, string> = {
  WEBHOOK: 'webhook',
  PULL: msg('опрос ленты'),
  MANUAL: msg('вручную'),
};
export const EVENT_TYPE_RU: Record<string, string> = {
  booking_new: msg('новая бронь'),
  booking_modification: msg('изменение'),
  booking_cancellation: msg('отмена'),
};

/** Сверка давнее суток с запасом: сторож сверяет раз в сутки, после 36 часов это уже повод посмотреть */
export const RECONCILE_STALE_MS = 36 * 3_600_000;

export interface ReconciliationView {
  tone: 'ok' | 'warn' | 'danger' | 'muted';
  value: string;
  sub: string;
}

/**
 * «Сверка с каналом» на обзоре (X3, ADR-144): ежедневная сверка остатков PMS с тем, что видит канал, словами.
 * Расхождение важнее давности; без данных API — «нет данных», не «всё хорошо».
 */
export function reconciliationView(
  r:
    | { lastCheckedAt: string | null; mismatch: { since: string; nights: number | null } | null }
    | null
    | undefined,
  clock: PropertyClock,
  now: number = Date.now(),
  t: Translate = translator('ru'),
  locale: DeskLocale = 'ru',
): ReconciliationView {
  if (!r) return { tone: 'muted', value: t('нет данных'), sub: t('обновите страницу') };
  if (r.mismatch) {
    const nights = r.mismatch.nights;
    return {
      tone: 'danger',
      value: nights
        ? t('расхождение: {n}', { n: countLabel(locale, t, nights, [msg('ночь'), msg('ночи'), msg('ночей')]) })
        : t('есть расхождение'),
      sub: t('канал видит больше мест, чем есть, с {time}; сторож запустил полную выгрузку', {
        time: eventTime(r.mismatch.since, clock),
      }),
    };
  }
  if (!r.lastCheckedAt)
    return { tone: 'muted', value: t('ещё не было'), sub: t('сверка идёт раз в сутки') };
  const stale = now - Date.parse(r.lastCheckedAt) > RECONCILE_STALE_MS;
  return stale
    ? {
        tone: 'warn',
        value: t('давно не было'),
        sub: t('последняя {time}', { time: eventTime(r.lastCheckedAt, clock) }),
      }
    : {
        tone: 'ok',
        value: t('расхождений нет'),
        sub: t('проверено {time}', { time: eventTime(r.lastCheckedAt, clock) }),
      };
}

/**
 * Подпись под «Обмен с каналами»: слова для владельца, а не код состояния API (аудит 22.10.2026 P1-19:
 * было «Объект не сопоставлен.»). Сообщение API остаётся запасным для состояний, которых здесь нет.
 */
export function connectionSummary(
  state: string | undefined,
  message: string | undefined,
  t: Translate = translator('ru'),
): string {
  if (state === 'NO_MAPPING')
    return t('Гостиница ещё не подключена к Booking.com, Ostrovok и другим каналам.');
  if (state === 'NO_KEY') return t('Менеджер каналов ещё не подключён.');
  return `${message ?? t('Не удалось проверить соединение с менеджером каналов')}.`;
}

/** «Приём броней» из каналов одним словом: без «не зарегистрирован» и имени переменной окружения */
export function webhookWord(
  webhook: { registered: boolean; active: boolean; expectedUrl: string | null } | null,
  t: Translate = translator('ru'),
): string {
  if (webhook === null) return t('состояние неизвестно');
  if (webhook.registered) return webhook.active ? t('работает') : t('выключен');
  return webhook.expectedUrl ? t('не настроен') : t('адрес сервера не задан');
}
