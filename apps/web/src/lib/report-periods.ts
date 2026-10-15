const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Готовые отрезки отчётов от «сегодня» объекта (С-13): день даёт пояс объекта, дальше — календарная
 * арифметика. Общие для «Финансов» и хаба «Отчёты» (REP1) — один расчёт, одни границы месяцев.
 */
export function periods(today: string) {
  const now = new Date(`${today}T00:00:00Z`);
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return {
    today,
    month: { from: iso(new Date(Date.UTC(y, m, 1))), to: iso(new Date(Date.UTC(y, m + 1, 0))) },
    prevMonth: { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(new Date(Date.UTC(y, m, 0))) },
    week: { from: iso(new Date(now.getTime() - 6 * 86400000)), to: iso(now) },
  };
}
