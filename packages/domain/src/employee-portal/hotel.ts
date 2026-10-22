/**
 * Кабинет горничной и ресепшена гостиницы (решение владельца 22.10.2026, docs/decisions/2026-10-22-hotel-staff-cabinet.md,
 * DATA_MODEL §4.1): что отдаёт `GET /hotel-staff/me`. Только своё: номера, где я «Кто убирает», мои задачи, моя неделя,
 * моя зарплата за месяц и одна строка «Мой месяц». Деньги строками в тиынах (ADR-008).
 */
import type { WeekTemplateDay } from '../beauty/schedule';

export type HotelHousekeepingStatus = 'DIRTY' | 'CLEAN' | 'INSPECTED';

export interface HotelStaffUnit {
  code: string;
  /** Номер комнаты и где она (корпус, этаж) */
  roomNumber: string;
  place: string;
  categoryName: string;
  status: HotelHousekeepingStatus;
  /** Уборку этого номера сегодня закрыл я */
  cleanedToday: boolean;
}

export interface HotelStaffTask {
  id: string;
  title: string;
  note: string | null;
  /** Дата по часам объекта, ГГГГ-ММ-ДД (на экране через human-period) */
  dueDate: string;
  dueTime: string | null;
  priority: 'LOW' | 'NORMAL' | 'HIGH';
  done: boolean;
  overdue: boolean;
}

export interface HotelStaffMonth {
  month: string;
  /** Мои уборки «Грязно → Убрано» за месяц по поясу объекта */
  cleanings: number;
  tasksDone: number;
  shifts: number;
  daysOff: number;
}

export interface HotelStaffPay {
  month: string;
  currency: string;
  fixedMinor: string;
  perCleaningMinor: string;
  cleanings: number;
  pieceMinor: string;
  bonusMinor: string;
  penaltyMinor: string;
  totalMinor: string;
}

export interface HotelStaffCabinetDto {
  me: { id: string; name: string };
  property: { name: string; timezone: string };
  today: string;
  units: HotelStaffUnit[];
  tasks: HotelStaffTask[];
  week: WeekTemplateDay[];
  month: HotelStaffMonth;
  pay: HotelStaffPay;
}

/** Порядок «Моих уборок»: сначала грязные (их убирать), потом убранные, проверенные в конце; внутри по номеру */
export function hotelUnitOrder(a: HotelStaffUnit, b: HotelStaffUnit): number {
  const rank = { DIRTY: 0, CLEAN: 1, INSPECTED: 2 } as const;
  return rank[a.status] - rank[b.status] || a.roomNumber.localeCompare(b.roomNumber, 'ru', { numeric: true }) || a.code.localeCompare(b.code);
}

/** Мои задачи: открытые со сроком не позже сегодня (просроченные первыми), затем сделанные сегодня */
export function hotelTaskOrder(a: HotelStaffTask, b: HotelStaffTask): number {
  return Number(a.done) - Number(b.done) || a.dueDate.localeCompare(b.dueDate) || (a.dueTime ?? '').localeCompare(b.dueTime ?? '') || a.id.localeCompare(b.id);
}
