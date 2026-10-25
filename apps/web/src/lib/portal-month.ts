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
  if (s.bonusMinor !== null) parts.push(t('бонусы {sum}', { sum: formatMoney(s.bonusMinor, s.currency) }));
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
