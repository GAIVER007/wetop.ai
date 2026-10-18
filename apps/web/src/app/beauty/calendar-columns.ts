import type { BeautyAppointmentRow, BeautyDay, BeautyEmployeeRow } from '../../lib/api';
/** Historical appointments remain visible after a master is archived or unassigned. */
export function calendarColumns(day: BeautyDay, employees: BeautyEmployeeRow[]) {
  const columns = [...day.columns];
  for (const appointment of appointmentSegments(day.appointments)) {
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

/** Calendar occupancy uses service intervals; payment and visit counts use the parent. */
export function appointmentSegments(rows: BeautyAppointmentRow[]) {
  return rows.flatMap((row) =>
    row.items?.length
      ? row.items.map((item) => ({
          ...row,
          ...item,
          id: row.id,
          segmentKey: item.id,
          appointment: row,
        }))
      : [{ ...row, segmentKey: row.id, appointment: row }],
  );
}

export function matchesAppointment(row: BeautyAppointmentRow, employee: string, service: string) {
  return (row.items?.length ? row.items : [row]).some(
    (item) =>
      (!employee || item.employeeId === employee) && (!service || item.serviceId === service),
  );
}
