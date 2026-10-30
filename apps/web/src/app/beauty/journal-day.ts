import type { BeautyAppointmentRow } from '../../lib/api';
import { msg } from '../../i18n';

/**
 * Журнал салона, вариант B (владелец 24.10.2026, эскиз `sketches/salon-journal-2026-10-24/`): загрузка мастера
 * над колонкой, «Ближайшие» с быстрым действием и «Деньги за день» в панели справа. Чистые функции без React.
 */

/** Кто придёт: записанные и подтверждённые с «сейчас» минус 30 минут (опоздавшие видны), по времени, до пяти */
/**
 * «Ближайшие» (владелец 30.10.2026): запись висит, пока не оплачена. Ещё не пришли (записан, подтверждена) и пришли
 * без полной оплаты (в работе, завершена); оплатили полностью, не пришёл или отменили: уходит. По времени, раньше
 * сверху: утренний долг виден первым. `arrived`: только что отмечены «Пришла», до обновления страницы уже «Без оплаты».
 */
export function upcoming(
  rows: BeautyAppointmentRow[],
  _nowMinutes: number | null,
  limit = 5,
  arrived: ReadonlySet<string> = new Set(),
): BeautyAppointmentRow[] {
  return rows
    .map((r) => (arrived.has(r.id) && (r.status === 'BOOKED' || r.status === 'CONFIRMED') ? { ...r, status: 'IN_PROGRESS' as const } : r))
    .filter((r) => {
      if (r.status === 'CANCELLED' || r.status === 'NO_SHOW') return false;
      if (r.status === 'BOOKED' || r.status === 'CONFIRMED') return true;
      return BigInt(r.paidMinor || '0') < BigInt(r.priceMinor || '0');
    })
    .sort((a, b) => a.startMinutes - b.startMinutes || a.id.localeCompare(b.id))
    .slice(0, limit);
}

/** Метка пришедшей неоплаченной записи в «Ближайших»: в работе «Без оплаты», завершена «Долг»; ещё не пришли: нет */
export function upcomingTag(row: Pick<BeautyAppointmentRow, 'status'>): string | null {
  if (row.status === 'IN_PROGRESS') return msg('Без оплаты');
  if (row.status === 'DONE') return msg('Долг');
  return null;
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

/**
 * Оплата на плашке записи (владелец 25.10.2026: «400 QAR Не опл…» обрезалось в узкой колонке): короткое слово, которое
 * помещается всегда, и полное для подсказки и читалки. Неявка денег не ждёт, оплаты на ней нет.
 */
export function tilePayment(
  row: Pick<BeautyAppointmentRow, 'status' | 'priceMinor' | 'paidMinor'>,
): { kind: 'paid' | 'partial' | 'debt'; word: string; full: string } | null {
  if (row.status === 'NO_SHOW') return null;
  const paid = BigInt(row.paidMinor || '0');
  const price = BigInt(row.priceMinor || '0');
  if (paid >= price) return { kind: 'paid', word: msg('Оплачено'), full: msg('Оплачено') };
  if (paid > 0n) return { kind: 'partial', word: msg('Частично'), full: msg('Оплачено частично') };
  return { kind: 'debt', word: msg('Долг'), full: msg('Не оплачено') };
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
