/** Русское склонение по числу: pluralRu(5, ['ночь', 'ночи', 'ночей']) → «5 ночей». */
export function pluralRu(n: number, forms: [string, string, string], withNumber = true): string {
  const abs = Math.abs(n);
  const d = abs % 10;
  const h = abs % 100;
  const word =
    h >= 11 && h <= 14 ? forms[2] : d === 1 ? forms[0] : d >= 2 && d <= 4 ? forms[1] : forms[2];
  return withNumber ? `${n} ${word}` : word;
}

/** Число ночей между датами проживания (YYYY-MM-DD); неверные даты дают 0. */
export function nightsBetween(arrival: string, departure: string): number {
  const a = Date.parse(`${arrival}T00:00:00Z`);
  const d = Date.parse(`${departure}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(d) || d <= a) return 0;
  return Math.round((d - a) / 86_400_000);
}
