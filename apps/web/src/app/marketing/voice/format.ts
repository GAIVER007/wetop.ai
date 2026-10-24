import type { BadgeTone } from '../../../components/ui';
import type { VoiceBookingRow, VoiceSummaryView } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { countLabel, msg, translator, type DeskLocale } from '../../../i18n';

export type { VoiceSummaryView };

/**
 * Подписи и числа раздела «Голосовой агент»: чистые функции без обращения к API (тестируются отдельно). Подписи
 * размечены `msg` и переводятся при показе; составные строки (длительность, что забронировано) собираются на языке
 * `locale` (KK3), по умолчанию русском.
 */
const NO_DATA = msg('Нет данных');
const DASH = '–';

/** Что агент оформляет по телефону, зависит от направления: подсказка над выключателем */
export function bookingHint(vertical: 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE' | null): string {
  if (vertical === 'BEAUTY')
    return msg('Агент ищет свободное время у мастера или у любого свободного и записывает клиента с его именем, телефоном и пожеланием. Запись ждёт подтверждения администратора.');
  if (vertical === 'FOOD_SERVICE')
    return msg('Агент проверяет, что на нужное время есть место, и бронирует на имя и телефон гостя с комментарием. Номер стола агент не называет: его назначает администратор.');
  if (vertical === 'HOSPITALITY')
    return msg('Агент проверяет свободные номера и цену проживания и бронирует после явного согласия гостя. Оплату и паспортные данные по телефону он не берёт.');
  return msg('У филиала нет агента ИИ-продавца: создайте его, чтобы включить бронь по телефону.');
}

/** Дата ГГГГ-ММ-ДД → ДД.ММ.ГГГГ (даты проживания без пояса: AGENTS.md §13) */
const dayText = (iso: string | undefined): string => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('.') : DASH);

const guestsText = (n: number | undefined, locale: DeskLocale): string => {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '';
  return countLabel(locale, translator(locale), n, [msg('гость'), 'гостя', msg('гостей')]); // kk-allow: форма склонения
};

export function bookingKindLabel(kind: VoiceBookingRow['kind']): string {
  return kind === 'HOTEL' ? msg('Номер') : kind === 'APPOINTMENT' ? msg('Запись') : msg('Стол');
}

/** Что забронировано, одной строкой: без имени и телефона гостя (их в списке нет) */
export function bookingTitle(row: VoiceBookingRow, timezone: string, locale: DeskLocale = 'ru'): string {
  const t = translator(locale);
  const price = row.totalMinor && row.totalMinor !== '0' ? formatMoney(row.totalMinor, row.currency ?? 'KZT') : null;
  const parts: Array<string | null | undefined> =
    row.kind === 'HOTEL'
      ? [row.category, `${dayText(row.arrival)} – ${dayText(row.departure)}`, guestsText(row.adults, locale), row.reference ? `№ ${row.reference}` : null, price]
      : row.kind === 'APPOINTMENT'
        ? [row.service, row.master ? t('мастер {name}', { name: row.master }) : null, row.startsAt ? formatWhen(row.startsAt, timezone) : null, price]
        : [row.startsAt ? formatWhen(row.startsAt, timezone) : null, guestsText(row.partySize, locale), row.period];
  return parts.filter((p): p is string => !!p).join(', ');
}

const BOOKING_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  BOOKED: { label: msg('Ждёт подтверждения'), tone: 'warn' },
  TENTATIVE: { label: msg('Ждёт подтверждения'), tone: 'warn' },
  CONFIRMED: { label: msg('Подтверждена'), tone: 'ok' },
  IN_PROGRESS: { label: msg('Идёт'), tone: 'info' },
  SEATED: { label: msg('За столом'), tone: 'info' },
  CHECKED_IN: { label: msg('Заселён'), tone: 'info' },
  DONE: { label: msg('Выполнена'), tone: 'ok' },
  COMPLETED: { label: msg('Завершена'), tone: 'ok' },
  CHECKED_OUT: { label: msg('Выехал'), tone: 'ok' },
  NO_SHOW: { label: msg('Не пришёл'), tone: 'danger' },
  CANCELLED: { label: msg('Отменена'), tone: 'danger' },
};

/** Статус брони сейчас (администратор мог подтвердить или отменить); неизвестный не выдумывается */
export function bookingStatus(_kind: VoiceBookingRow['kind'], status: string | null): { label: string; tone: BadgeTone } {
  return (status && BOOKING_STATUS[status]) || { label: DASH, tone: 'neutral' };
}

export function formatDuration(seconds: number | null, locale: DeskLocale = 'ru'): string {
  const t = translator(locale);
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return DASH;
  const s = Math.floor(seconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  if (hours > 0) return minutes > 0 ? t('{h} ч {m} мин', { h: hours, m: minutes }) : t('{h} ч', { h: hours });
  if (minutes > 0) return rest > 0 ? t('{m} мин {s} с', { m: minutes, s: rest }) : t('{m} мин', { m: minutes });
  return t('{s} с', { s: rest });
}

/** +7 700 111 22 33 для номеров +7; остальное, включая маски, как есть */
export function formatPhone(value: string): string {
  const match = /^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(value);
  return match ? `+7 ${match[1]} ${match[2]} ${match[3]} ${match[4]}` : value;
}

/** Время звонка в часовом поясе филиала; ошибка в данных не должна ронять страницу */
export function formatWhen(iso: string, timezone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return DASH;
  const parts = (zone: string) =>
    new Intl.DateTimeFormat('ru-RU', {
      timeZone: zone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date);
  try {
    return parts(timezone);
  } catch {
    return parts('UTC');
  }
}

const STATES: Record<string, { label: string; tone: BadgeTone }> = {
  RECEIVED: { label: msg('Принят'), tone: 'info' },
  ANSWERED: { label: msg('Идёт разговор'), tone: 'info' },
  ENDED: { label: msg('Завершён'), tone: 'ok' },
  REJECTED: { label: msg('Отклонён'), tone: 'warn' },
  FAILED: { label: msg('Сбой'), tone: 'danger' },
};

export function stateBadge(state: string): { label: string; tone: BadgeTone } {
  return STATES[state] ?? { label: state, tone: 'neutral' };
}

export function callbackStatusLabel(status: 'NEW' | 'DONE'): string {
  return status === 'NEW' ? msg('Ждёт звонка') : msg('Обработана');
}

export interface SummaryItem {
  key: 'calls' | 'answered' | 'callbacks' | 'transfers' | 'avg' | 'rejected';
  label: string;
  value: string;
}

/** Итоги месяца одной строкой. Журнал пуст: «Нет данных», а не выдуманные нули */
export function summaryItems(view: VoiceSummaryView, locale: DeskLocale = 'ru'): SummaryItem[] {
  const totals = view.totals;
  const num = (n: number) => (view.hasData ? String(n) : NO_DATA);
  return [
    { key: 'calls', label: msg('Звонков'), value: num(totals.calls) },
    { key: 'answered', label: msg('Принято агентом'), value: num(totals.answered) },
    { key: 'callbacks', label: msg('Просьб перезвонить'), value: num(totals.callbacks) },
    { key: 'transfers', label: msg('Переведено на человека'), value: num(totals.transfers) },
    { key: 'avg', label: msg('Средний разговор'), value: view.hasData ? formatDuration(totals.avgDurationSeconds, locale) : NO_DATA },
    { key: 'rejected', label: msg('Отклонено'), value: num(totals.rejected) },
  ];
}
