/** «Этот месяц» журнала: список записей филиала за календарный месяц дня `today` (владелец 25.10.2026) */
export const monthHref = (today: string) => {
  const [year, month] = today.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, '0');
  return `/appointments?from=${year}-${mm}-01&to=${year}-${mm}-${String(last).padStart(2, '0')}`;
};
