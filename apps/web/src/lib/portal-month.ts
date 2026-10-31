/**
 * Строка итогов «Мой месяц» в кабинете сотрудника (срез S2, владелец 21.10.2026): одна строка, без плиток
 * (правило владельца об итогах). «Октябрь: 12 смен, 4 выходных, 37 услуг, выручка 450 000 ₸, бонусы 10 000 ₸».
 */
import type { PortalMonthStats, PortalTimeOff } from '@pms/domain';
import { countLabel, intlLocale, msg, translator, type DeskLocale, type Translate } from '../i18n';
import { dateFormat } from '../i18n/dates';
import { formatMoney } from './money';

const monthFmt = new Intl.DateTimeFormat('ru-RU', { month: 'long', timeZone: 'UTC' });

/** «Октябрь», для другого года «Октябрь 2025»; `locale` даёт месяц на языке человека */
export function portalMonthLabel(month: string, currentYear: string, locale: DeskLocale = 'ru'): string {
  const fmt = locale === 'ru' ? monthFmt : dateFormat(intlLocale(locale), { month: 'long', timeZone: 'UTC' });
  const name = fmt.format(new Date(`${month}-15T12:00:00Z`));
  const cap = name.charAt(0).toUpperCase() + name.slice(1);
  return month.slice(0, 4) === currentYear ? cap : `${cap} ${month.slice(0, 4)}`;
}

/** Соседний месяц ГГГГ-ММ (стрелки переключателя): тот же расчёт, что у сервера */
export { shiftMonth as portalShiftMonth } from '@pms/domain';

export function portalMonthParts(s: PortalMonthStats, t: Translate = translator('ru'), locale: DeskLocale = 'ru'): string[] {
  const count = (n: number, forms: [string, string, string]) => countLabel(locale, t, n, forms);
  const parts: string[] = [];
  if (s.shifts !== null) parts.push(count(s.shifts, [msg('смена'), 'смены', msg('смен')])); // kk-allow: форма склонения
  if (s.daysOff !== null) {
    const off = count(s.daysOff, [msg('выходной'), 'выходных', msg('выходных')]); // kk-allow: форма склонения
    parts.push(
      s.absenceDays
        ? t('{off} (из них {days} отсутствия)', { off, days: count(s.absenceDays, [msg('день'), 'дня', msg('дней')]) }) // kk-allow: форма склонения
        : off,
    );
  }
  if (s.appointmentsDone !== null) parts.push(count(s.appointmentsDone, [msg('запись'), 'записи', msg('записей')])); // kk-allow: форма склонения
  if (s.servicesDone !== null) parts.push(count(s.servicesDone, [msg('услуга'), 'услуги', msg('услуг')])); // kk-allow: форма склонения
  if (s.ordersClosed !== null) parts.push(count(s.ordersClosed, [msg('заказ'), 'заказа', msg('заказов')])); // kk-allow: форма склонения
  if (s.tablesServed !== null) parts.push(count(s.tablesServed, [msg('стол'), 'стола', msg('столов')])); // kk-allow: форма склонения
  if (s.guests !== null) parts.push(count(s.guests, [msg('гость'), 'гостя', msg('гостей')])); // kk-allow: форма склонения
  if (s.revenueMinor !== null) parts.push(t('выручка {sum}', { sum: formatMoney(s.revenueMinor, s.currency) }));
  if (s.percent !== null) parts.push(t('мой процент {n}%', { n: s.percent }));
  // премий нет (владелец 30.10.2026): «бонусы» в строке месяца только если они начислены
  if (s.bonusMinor !== null && BigInt(s.bonusMinor) !== 0n) parts.push(t('бонусы {sum}', { sum: formatMoney(s.bonusMinor, s.currency) }));
  return parts;
}

export function portalMonthLine(
  s: PortalMonthStats,
  currentYear: string,
  t: Translate = translator('ru'),
  locale: DeskLocale = 'ru',
): string {
  const label = portalMonthLabel(s.month, currentYear, locale);
  if (s.status === 'SELECT_LOCATION') return t('{month}: выберите филиал, чтобы увидеть итоги месяца', { month: label });
  const parts = portalMonthParts(s, t, locale);
  return parts.length ? `${label}: ${parts.join(', ')}` : t('{month}: итоги недоступны', { month: label });
}

/** Инициалы для карточки без фото: «Айгерим Сапарова» → «АС», одно слово → две буквы */
export function portalInitials(name: string): string {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  const letters = words.length > 1 ? [words[0]![0], words[1]![0]] : [...(words[0] ?? '?')].slice(0, 2);
  return letters.join('').toLocaleUpperCase();
}

/** Плитка цифр месяца в карточке сотрудника (вариант A, владелец 28.10.2026) */
export interface PortalMonthTile { id: string; label: string; value: string; hint?: string }

/**
 * Цифры месяца крупными плитками: выручка, визиты (салон) или заказы и гости (ресторан), ЗП, оценка.
 * Показываем только то, что сервер посчитал: null и «не настроено» плиткой не становятся, оценка без отзывов
 * не выдумывается. Без выбранного филиала плиток нет (строка над ними просит выбрать филиал).
 */
export function portalMonthTiles(
  s: PortalMonthStats,
  extra: {
    pay: { status: string; earnedMinor: string | null; currency: string } | null;
    reviews: { averageStars: number | null; count: number } | null;
  },
  t: Translate = translator('ru'),
  locale: DeskLocale = 'ru',
): PortalMonthTile[] {
  if (s.status === 'SELECT_LOCATION') return [];
  const tiles: PortalMonthTile[] = [];
  const num = (n: number) => new Intl.NumberFormat(intlLocale(locale)).format(n);
  if (s.revenueMinor !== null) tiles.push({ id: 'revenue', label: t('Выручка'), value: formatMoney(s.revenueMinor, s.currency) });
  if (s.appointmentsDone !== null) tiles.push({ id: 'visits', label: t('Визиты'), value: num(s.appointmentsDone) });
  if (s.servicesDone !== null) tiles.push({ id: 'services', label: t('Услуги'), value: num(s.servicesDone) });
  if (s.ordersClosed !== null) tiles.push({ id: 'orders', label: t('Заказы'), value: num(s.ordersClosed) });
  if (s.guests !== null) tiles.push({ id: 'guests', label: t('Гости'), value: num(s.guests) });
  const pay = extra.pay;
  if (pay && pay.status === 'AVAILABLE' && pay.earnedMinor !== null)
    tiles.push({ id: 'pay', label: t('ЗП'), value: formatMoney(pay.earnedMinor, pay.currency) });
  const r = extra.reviews;
  if (r && r.count > 0 && r.averageStars !== null)
    tiles.push({
      id: 'rating',
      label: t('Оценка'),
      value: `${new Intl.NumberFormat(intlLocale(locale), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.round(r.averageStars * 10) / 10)} ★`,
      hint: countLabel(locale, t, r.count, [msg('отзыв'), 'отзыва', msg('отзывов')]), // kk-allow: форма склонения
    });
  // у ресторана без ЗП и отзывов четвёртая плитка смены: карточка не остаётся пустой
  if (tiles.length < 4 && s.shifts !== null) tiles.push({ id: 'shifts', label: t('Смены'), value: num(s.shifts) });
  return tiles;
}

/** Отсутствия сотрудника (срез S3): текущие и будущие сверху по дате, прошедшие отдельно, свежие первыми */
export function portalAbsences(timeOffs: readonly PortalTimeOff[], today: string) {
  const upcoming = timeOffs.filter((t) => t.dateTo >= today).sort((a, b) => a.dateFrom.localeCompare(b.dateFrom));
  const past = timeOffs.filter((t) => t.dateTo < today).sort((a, b) => b.dateFrom.localeCompare(a.dateFrom));
  return { upcoming, past };
}

/** Число дней отсутствия включительно: «3 дня» */
export function portalAbsenceDays(off: PortalTimeOff, t: Translate = translator('ru'), locale: DeskLocale = 'ru'): string {
  const days = Math.round((Date.parse(`${off.dateTo}T00:00:00Z`) - Date.parse(`${off.dateFrom}T00:00:00Z`)) / 86_400_000) + 1;
  return countLabel(locale, t, days, [msg('день'), 'дня', msg('дней')]); // kk-allow: форма склонения
}
