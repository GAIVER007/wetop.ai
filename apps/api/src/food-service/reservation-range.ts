/**
 * Даты запроса броней ресторана. Без `dateTo` один день (расписание «Шкала / Список»); с `dateTo` диапазон
 * для вида «Месяц» (владелец 26.10.2026: месяц во всех вертикалях): сетка с понедельника по воскресенье,
 * не больше 42 дней, чтобы один запрос не тянул год броней.
 */
export const RESERVATION_RANGE_MAX_DAYS = 42;

function calendarDate(raw: unknown): string {
  if (
    typeof raw !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(raw) ||
    !Number.isFinite(Date.parse(raw)) ||
    new Date(raw).toISOString().slice(0, 10) !== raw
  )
    throw new Error('Нужна календарная дата');
  return raw;
}

export function reservationRange(date: unknown, dateTo?: unknown): { dateFrom: string; dateTo: string } {
  const dateFrom = calendarDate(date);
  if (dateTo === undefined) return { dateFrom, dateTo: dateFrom };
  const to = calendarDate(dateTo);
  const days = (Date.parse(to) - Date.parse(dateFrom)) / 86_400_000 + 1;
  if (days < 1 || days > RESERVATION_RANGE_MAX_DAYS) throw new Error('Нужна календарная дата');
  return { dateFrom, dateTo: to };
}
