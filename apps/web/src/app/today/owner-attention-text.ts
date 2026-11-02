import { msg, type DeskLocale, type Translate } from '../../i18n';
import type { OwnerAttentionItem } from '../../lib/owner-summary';

/**
 * «Требуют решения» на языке человека (инструкция гостиницы 01.11.2026): API присылает готовую русскую строку, а на
 * английской и казахской Главной она выходила по-русски. По-русски показываем текст API как есть; на других языках
 * экран собирает строку сам из id, числа и дат строки. Неизвестный id остаётся текстом API.
 */
const plural = (locale: DeskLocale, n: number, one: string, many: string) => `${n} ${locale === 'en' && n === 1 ? one : many}`;

export function attentionLine(item: OwnerAttentionItem, t: Translate, locale: DeskLocale): { text: string; action: string } {
  const action = t(item.action);
  if (locale === 'ru') return { text: item.text, action: item.action };
  const n = item.count ?? 0;
  const beds = item.detail?.beds === true;
  const units = (k: number) =>
    beds ? plural(locale, k, t('место'), t('мест')) : plural(locale, k, t('номер'), t('номеров'));
  const dirtyCount = item.detail?.dirty ?? n;
  switch (item.id) {
    case 'open-shift': {
      return { text: t('Смена с {date} не закрыта', { date: item.detail?.since ?? '' }), action };
    }
    case 'dirty-rooms':
      return { text: t('Не убрано: {units}', { units: units(dirtyCount) }), action };
    case 'arrivals': {
      const arrivals = plural(locale, n, t('заезд'), t('заездов'));
      if (item.detail?.dirty) return { text: t('{arrivals}, не убрано: {units}', { arrivals, units: units(dirtyCount) }), action };
      if (item.detail?.clean) return { text: t('{arrivals} сегодня, номера убраны', { arrivals }), action };
      return { text: t('{arrivals} сегодня', { arrivals }), action };
    }
    case 'no-prepayment':
      return { text: t('{bookings} без предоплаты', { bookings: plural(locale, n, t('бронь'), t('броней')) }), action };
    case 'low-stock':
      return { text: t('Заканчивается: {items}', { items: plural(locale, n, t('позиция'), t('позиций')) }), action };
    case 'late-unmarked':
      return { text: t('Не отмечены «Пришла»: {count}', { count: plural(locale, n, t('запись'), t('записей')) }), action };
    case 'unpaid-visits':
      return { text: t('Не оплачено сегодня: {count}', { count: plural(locale, n, t('запись'), t('записей')) }), action };
    case 'unconfirmed-tomorrow':
      return { text: t('Подтвердить на завтра: {count}', { count: plural(locale, n, t('запись'), t('записей')) }), action };
    case 'free-windows':
      return { text: t('Свободные окна: {count}', { count: plural(locale, n, t('мастер'), t('мастеров')) }), action };
    case 'stale-orders':
      return { text: t('Открыты дольше 2 ч: {count}', { count: plural(locale, n, t('счёт'), t('счетов')) }), action };
    case 'all-clear':
      return { text: t('Срочных дел нет'), action };
    default:
      return { text: item.text, action };
  }
}

/** Слова строк для словарей en/kk: ключи выше идут через `t()` с этими русскими исходниками */
export const ATTENTION_PHRASES = [
  msg('Смена с {date} не закрыта'),
  msg('Не убрано: {units}'),
  msg('{arrivals}, не убрано: {units}'),
  msg('{arrivals} сегодня, номера убраны'),
  msg('{arrivals} сегодня'),
  msg('{bookings} без предоплаты'),
  msg('Заканчивается: {items}'),
  msg('Не отмечены «Пришла»: {count}'),
  msg('Не оплачено сегодня: {count}'),
  msg('Подтвердить на завтра: {count}'),
  msg('Свободные окна: {count}'),
  msg('Открыты дольше 2 ч: {count}'),
  msg('место'),
  msg('мест'),
  msg('номер'),
  msg('номеров'),
  msg('заезд'),
  msg('заездов'),
  msg('бронь'),
  msg('броней'),
  msg('позиция'),
  msg('позиций'),
  msg('запись'),
  msg('записей'),
  msg('мастер'),
  msg('мастеров'),
  msg('счёт'),
  msg('счетов'),
];
