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
  // ссылка с точными датами (Главная, отчёты, закладки) открывает ровно их; переключатель ведёт уже по месяцам
  const day = /^\d{4}-\d{2}-\d{2}$/;
  const exact = !sp.month && sp.from && day.test(sp.from) && sp.from.slice(0, 7) === month && sp.from <= today;
  const from = exact ? sp.from! : `${month}-01`;
  const monthEnd = month === current ? today : `${month}-${pad(lastDay(y, m))}`;
  const toAsked = sp.to ?? sp.from;
  const to = exact && toAsked && day.test(toAsked) && toAsked >= from && toAsked <= monthEnd ? toAsked : monthEnd;
  const previousMonth = shift(month, -1);
  const py = Number(previousMonth.slice(0, 4));
  const pm = Number(previousMonth.slice(5, 7));
  const prevDay = (d: string) => pad(Math.min(Number(d.slice(8, 10)), lastDay(py, pm)));
  return {
    month,
    from,
    to,
    prev: { from: `${previousMonth}-${prevDay(from)}`, to: `${previousMonth}-${prevDay(to)}` },
    next: month < current ? shift(month, 1) : null,
    previousMonth,
  };
}
