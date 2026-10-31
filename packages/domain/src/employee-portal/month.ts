/**
 * «Мой месяц» в кабинете сотрудника (срез S2, владелец 21.10.2026). Модели «смена на дату» нет (D-roles §2):
 * смены = дни месяца, у которых в недельном графике есть часы, минус дни отсутствия (TimeOff). Выходные = остальные
 * дни месяца. Даты календарные (DATE филиала), без часовых сдвигов.
 */
const DAY = 86_400_000;
const at = (date: string) => Date.parse(`${date}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export function monthBounds(month: string): { from: string; to: string } {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new RangeError('Месяц в формате ГГГГ-ММ');
  const [y, m] = month.split('-').map(Number) as [number, number];
  return { from: `${month}-01`, to: iso(Date.UTC(y, m, 1) - DAY) };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export interface MonthShiftDays { shifts: number; daysOff: number; absenceDays: number }

/** Смены по графику за месяц: weekday 0 = воскресенье (как WorkingHours) */
export function monthShiftDays(input: {
  month: string;
  workingWeekdays: readonly number[];
  timeOffs: ReadonlyArray<{ dateFrom: string; dateTo: string }>;
}): MonthShiftDays {
  const { from, to } = monthBounds(input.month);
  const working = new Set(input.workingWeekdays);
  let shifts = 0, absenceDays = 0, total = 0;
  for (let t = at(from); t <= at(to); t += DAY) {
    total += 1;
    if (!working.has(new Date(t).getUTCDay())) continue;
    const date = iso(t);
    if (input.timeOffs.some((o) => o.dateFrom <= date && date <= o.dateTo)) absenceDays += 1;
    else shifts += 1;
  }
  return { shifts, daysOff: total - shifts, absenceDays };
}

/** Даты недели (от понедельника), когда сотрудник отсутствует (TimeOff): для графика по неделям (31.10.2026) */
export function weekAbsentDates(monday: string, timeOffs: ReadonlyArray<{ dateFrom: string; dateTo: string }>): string[] {
  const out: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const date = iso(at(monday) + i * DAY);
    if (timeOffs.some((o) => o.dateFrom <= date && date <= o.dateTo)) out.push(date);
  }
  return out;
}
