/** Calendar DATE arithmetic: ISO week, Monday through Sunday, independent of browser timezone. */
export function weekPeriod(date: string, offset = 0) {
  const first = new Date(`${date}T00:00:00Z`);
  first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7) + offset * 7);
  const last = new Date(first);
  last.setUTCDate(last.getUTCDate() + 6);
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}
