/**
 * Ближайший день рождения гостя в окне [from, from + days) (образец Lite PMS «Дни рождения»,
 * Q-249 T0). Даты — строки ISO по поясу объекта; 29 февраля в невисокосный год празднуется 28-го.
 */
export function upcomingBirthday(
  birthDate: string | null,
  from: string,
  days: number,
): { date: string; age: number } | null {
  const m = birthDate ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate) : null;
  if (!m) return null;
  const [, by, bm, bd] = m.map(Number) as [number, number, number, number];
  const start = Date.parse(`${from}T00:00:00Z`);
  const fromYear = Number(from.slice(0, 4));
  for (const year of [fromYear, fromYear + 1]) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const day = bm === 2 && bd === 29 && !leap ? 28 : bd;
    const date = `${year}-${String(bm).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const offset = (Date.parse(`${date}T00:00:00Z`) - start) / 86_400_000;
    if (offset >= 0 && offset < days) return { date, age: year - by };
  }
  return null;
}
