import type { BeautyDay, BeautyEmployeeRow } from '../../lib/api';
/** Historical appointments remain visible after a master is archived or unassigned. */
export function calendarColumns(day: BeautyDay, employees: BeautyEmployeeRow[]) {
  const columns = [...day.columns];
  for (const appointment of day.appointments) {
    if (columns.some((c) => c.id === appointment.employeeId)) continue;
    const employee = employees.find((e) => e.id === appointment.employeeId);
    columns.push({
      id: appointment.employeeId,
      name: `${employee?.name ?? 'Мастер'} (не принимает)`,
      intervals: [],
      timeOff: false,
      timeOffReason: null,
      serviceIds: [],
    });
  }
  return columns;
}
