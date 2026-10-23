import type { HotelStaffCabinetDto } from '@pms/domain';
import { getJsonPublic, sendJson } from './api';
import type { FoodShiftRow, FoodShiftWeekDay, PayModel, PayrollRow, PayrollView } from './food-types';

/**
 * Кабинет горничной и ресепшена, сотрудники, график и зарплата гостиницы (решение 22.10.2026,
 * docs/decisions/2026-10-22-hotel-staff-cabinet.md). Зарплата и условия оплаты идут тем же API, что у салона и ресторана.
 */
export interface HotelEmployeeRow {
  id: string;
  name: string;
  active: boolean;
  personnelKind: string | null;
  hasLogin: boolean;
  unitsAssigned: number;
}
export type HotelPayrollRow = PayrollRow & { perCleaningMinor: string; cleanings: number; pieceMinor: string };
export type HotelPayrollView = Omit<PayrollView, 'rows'> & { rows: HotelPayrollRow[]; payouts?: boolean };

const id = (v: string) => encodeURIComponent(v);
export const hotelStaffApi = {
  cabinet: (month?: string) => getJsonPublic<HotelStaffCabinetDto>(`/hotel-staff/me${month ? `?month=${id(month)}` : ''}`),
  clean: (code: string) => sendJson<HotelStaffCabinetDto>('POST', `/hotel-staff/me/units/${id(code)}/clean`, {}),
  taskDone: (taskId: string) => sendJson<HotelStaffCabinetDto>('POST', `/hotel-staff/me/tasks/${id(taskId)}/done`, {}),
  employees: () => getJsonPublic<{ canManage: boolean; items: HotelEmployeeRow[] }>('/hotel-staff/employees'),
  createEmployee: (body: { name: string; phone?: string | null; email?: string | null; personnelKind: 'OTHER_EMPLOYEE' }) =>
    sendJson<{ id: string; name: string }>('POST', '/hotel-staff/employees', body),
  shifts: () => getJsonPublic<{ employees: FoodShiftRow[] }>('/hotel-staff/shifts'),
  setShifts: (employeeId: string, intervals: Array<{ weekday: number; timeFrom: string; timeTo: string }>, expectedRevision: string) =>
    sendJson<{ week: FoodShiftWeekDay[]; weekRevision: string }>('PUT', `/hotel-staff/employees/${id(employeeId)}/working-hours`, { intervals, expectedRevision }),
  assignHousekeeper: (code: string, employeeId: string | null) =>
    sendJson<unknown>('PUT', `/units/${id(code)}/housekeeping-assignee`, { employeeId }),
  payroll: (month: string) => getJsonPublic<HotelPayrollView>(`/food-service/payroll?month=${id(month)}`),
  setPaySettings: (employeeId: string, body: { model: PayModel; fixedMinor: number; percent: number; perCleaningMinor: number }) =>
    sendJson<unknown>('PUT', `/food-service/employees/${id(employeeId)}/pay-settings`, body),
  addPayAdjustment: (employeeId: string, body: { period: string; amountMinor: number; reason: string }) =>
    sendJson<unknown>('POST', `/food-service/employees/${id(employeeId)}/pay-adjustments`, body),
};
