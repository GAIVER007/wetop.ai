import type { BeautyAppointmentRow, BeautyDayColumn } from '../../lib/api';
import { clockMinutes } from './time';
import { msg } from '../../i18n';

/**
 * Журнал салона, вариант B (владелец 24.10.2026, эскиз `sketches/salon-journal-2026-10-24/`): загрузка мастера
 * над колонкой, «Ближайшие» с быстрым действием и «Деньги за день» в панели справа. Чистые функции без React.
 */

const counted = (r: BeautyAppointmentRow) => r.status !== 'CANCELLED' && r.status !== 'NO_SHOW';

/** Записей у мастера и доля занятых рабочих минут; выходной и отсутствие без процента */
export function masterLoad(column: BeautyDayColumn, rows: BeautyAppointmentRow[]): { count: number; percent: number | null } {
  const mine = rows.filter((r) => r.employeeId === column.id && counted(r));
  const work = column.timeOff
    ? 0
    : column.intervals.reduce((n, i) => n + Math.max(0, clockMinutes(i.timeTo) - clockMinutes(i.timeFrom)), 0);
  if (!work) return { count: mine.length, percent: null };
  const busy = mine.reduce((n, r) => n + Math.max(0, r.endMinutes - r.startMinutes), 0);
  return { count: mine.length, percent: Math.min(100, Math.round((busy / work) * 100)) };
}

/** Кто придёт: записанные и подтверждённые с «сейчас» минус 30 минут (опоздавшие видны), по времени, до пяти */
export function upcoming(rows: BeautyAppointmentRow[], nowMinutes: number | null, limit = 5): BeautyAppointmentRow[] {
  const from = nowMinutes === null ? -Infinity : nowMinutes - 30;
  return rows
    .filter((r) => (r.status === 'BOOKED' || r.status === 'CONFIRMED') && r.startMinutes >= from)
    .sort((a, b) => a.startMinutes - b.startMinutes || a.id.localeCompare(b.id))
    .slice(0, limit);
}

/** Одна кнопка в строке «Ближайших»: подтверждённая «Пришла» (начать визит), записанная «Подтвердить» */
export function quickAction(row: BeautyAppointmentRow): { to: 'IN_PROGRESS' | 'CONFIRMED'; label: string } | null {
  if (row.status === 'CONFIRMED' && row.next.includes('IN_PROGRESS')) return { to: 'IN_PROGRESS', label: msg('Пришла') };
  if (row.status === 'BOOKED' && row.next.includes('CONFIRMED')) return { to: 'CONFIRMED', label: msg('Подтвердить') };
  return null;
}

/**
 * Деньги дня в кассе: получено = оплачено деньгами минус возвраты (бонусы и сертификат не деньги в кассе, решение
 * 21.10.2026); ждём оплату = остаток по пришедшим и завершённым записям.
 */
export function dayMoney(
  rows: BeautyAppointmentRow[],
  /** валюта филиала: пустой день показывается в ней, а не в тенге */
  fallbackCurrency = 'KZT',
): { received: bigint; waiting: bigint; currency: string } {
  let received = 0n;
  let waiting = 0n;
  for (const r of rows) {
    if (r.status === 'CANCELLED') continue;
    const paid = BigInt(r.paidMinor || '0');
    const loyalty = BigInt(r.paidLoyaltyMinor || '0');
    received += paid - loyalty - BigInt(r.refundedMinor || '0');
    // ждём оплату по всем визитам дня, как «Не оплачено» на карточках; «не пришёл» денег не принесёт
    if (r.status !== 'NO_SHOW') {
      const rest = BigInt(r.priceMinor || '0') - paid;
      if (rest > 0n) waiting += rest;
    }
  }
  return { received, waiting, currency: rows[0]?.currency ?? fallbackCurrency };
}

/** Имя мастера в узкой колонке, когда мастеров 5 и больше: «Айгерим С.» (полное имя в подсказке) */
export function shortName(name: string): string {
  const [first, second] = name.trim().split(/\s+/);
  return second ? `${first} ${second[0]}.` : (first ?? '');
}

/** Час работы в узкой колонке: «09:00» → «9», «10:30» остаётся */
export function shortHour(time: string): string {
  const [h, m] = time.split(':');
  return m === '00' ? String(Number(h)) : time;
}
