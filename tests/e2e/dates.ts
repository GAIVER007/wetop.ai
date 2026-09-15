/** Даты для сквозных тестов: «сегодня» объекта (Asia/Almaty) и сдвиг в сутках. Без библиотек и без UTC-полуночи. */
export function almatyToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(now);
}
export function plusDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}
