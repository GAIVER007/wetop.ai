/** Сетка месяца журнала салона: с понедельника недели первого числа до воскресенья недели последнего (5–6 строк) */
export const plusDays = (date: string, n: number) => {
  const at = new Date(`${date}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() + n);
  return at.toISOString().slice(0, 10);
};

export function monthGrid(date: string): { month: string; days: string[] } {
  const month = date.slice(0, 7);
  const first = `${month}-01`;
  const [year, mm] = month.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(year, mm, 0)).toISOString().slice(0, 10);
  const weekday = (d: string) => (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7;
  const start = plusDays(first, -weekday(first));
  const end = plusDays(last, 6 - weekday(last));
  const days: string[] = [];
  for (let d = start; d <= end; d = plusDays(d, 1)) days.push(d);
  return { month, days };
}

/** тот же день соседнего месяца; 31-е в коротком месяце становится последним днём */
export function shiftMonth(date: string, delta: number): string {
  const [year, mm, dd] = date.split('-').map(Number) as [number, number, number];
  const target = new Date(Date.UTC(year, mm - 1 + delta, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(dd, lastDay));
  return target.toISOString().slice(0, 10);
}
