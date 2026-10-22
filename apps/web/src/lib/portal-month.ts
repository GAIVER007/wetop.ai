/**
 * Строка итогов «Мой месяц» в кабинете сотрудника (срез S2, владелец 21.10.2026): одна строка, без плиток
 * (правило владельца об итогах). «Октябрь: 12 смен, 4 выходных, 37 услуг, выручка 450 000 ₸, бонусы 10 000 ₸».
 */
import type { PortalMonthStats } from '@pms/domain';
import { formatMoney } from './money';
import { pluralRu } from './plural';

const monthFmt = new Intl.DateTimeFormat('ru-RU', { month: 'long', timeZone: 'UTC' });

/** «Октябрь», для другого года «Октябрь 2025» */
export function portalMonthLabel(month: string, currentYear: string): string {
  const name = monthFmt.format(new Date(`${month}-15T12:00:00Z`));
  const cap = name.charAt(0).toUpperCase() + name.slice(1);
  return month.slice(0, 4) === currentYear ? cap : `${cap} ${month.slice(0, 4)}`;
}

/** Соседний месяц ГГГГ-ММ (стрелки переключателя): тот же расчёт, что у сервера */
export { shiftMonth as portalShiftMonth } from '@pms/domain';

export function portalMonthParts(s: PortalMonthStats): string[] {
  const parts: string[] = [];
  if (s.shifts !== null) parts.push(pluralRu(s.shifts, ['смена', 'смены', 'смен']));
  if (s.daysOff !== null) {
    const off = pluralRu(s.daysOff, ['выходной', 'выходных', 'выходных']);
    parts.push(s.absenceDays ? `${off} (из них ${pluralRu(s.absenceDays, ['день', 'дня', 'дней'])} отсутствия)` : off);
  }
  if (s.appointmentsDone !== null) parts.push(pluralRu(s.appointmentsDone, ['запись', 'записи', 'записей']));
  if (s.servicesDone !== null) parts.push(pluralRu(s.servicesDone, ['услуга', 'услуги', 'услуг']));
  if (s.ordersClosed !== null) parts.push(pluralRu(s.ordersClosed, ['заказ', 'заказа', 'заказов']));
  if (s.tablesServed !== null) parts.push(pluralRu(s.tablesServed, ['стол', 'стола', 'столов']));
  if (s.guests !== null) parts.push(pluralRu(s.guests, ['гость', 'гостя', 'гостей']));
  if (s.revenueMinor !== null) parts.push(`выручка ${formatMoney(s.revenueMinor, s.currency)}`);
  if (s.percent !== null) parts.push(`мой процент ${s.percent}%`);
  if (s.bonusMinor !== null) parts.push(`бонусы ${formatMoney(s.bonusMinor, s.currency)}`);
  return parts;
}

export function portalMonthLine(s: PortalMonthStats, currentYear: string): string {
  const label = portalMonthLabel(s.month, currentYear);
  if (s.status === 'SELECT_LOCATION') return `${label}: выберите филиал, чтобы увидеть итоги месяца`;
  const parts = portalMonthParts(s);
  return parts.length ? `${label}: ${parts.join(', ')}` : `${label}: итоги недоступны`;
}
