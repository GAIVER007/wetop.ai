/**
 * Период «Аналитики» салона и ресторана месяцем (владелец 26.10.2026). Текущий месяц с 1-го по сегодня, прошлые
 * целиком, будущих нет. Сравнение с тем же отрезком прошлого месяца (1–26 октября против 1–26 сентября).
 */
const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const shift = (month: string, by: number) => {
  const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + by, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};

export function analyticsMonth(sp: Record<string, string | undefined>, today: string) {
  const current = today.slice(0, 7);
  const asked = sp.month ?? sp.from?.slice(0, 7);
  const valid = asked && /^\d{4}-(0[1-9]|1[0-2])$/.test(asked) && asked <= current;
  const month = valid ? asked : current;
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const from = `${month}-01`;
  const to = month === current ? today : `${month}-${pad(lastDay(y, m))}`;
  const previousMonth = shift(month, -1);
  const py = Number(previousMonth.slice(0, 4));
  const pm = Number(previousMonth.slice(5, 7));
  const prevDay = Math.min(Number(to.slice(8, 10)), lastDay(py, pm));
  return {
    month,
    from,
    to,
    prev: { from: `${previousMonth}-01`, to: `${previousMonth}-${pad(prevDay)}` },
    next: month < current ? shift(month, 1) : null,
    previousMonth,
  };
}
