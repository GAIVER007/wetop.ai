/**
 * Запись клиента к мастеру: правила, которых нет в базе (DATA_MODEL §19.1, срез B5).
 *
 * Пересечение записей одного мастера держит сама база (`EXCLUDE USING gist` на `appointments`), поэтому
 * здесь его нет. Здесь то, чего база не знает: продаётся ли услуга в этом филиале, попадает ли время в
 * график мастера, не стоит ли на этот день отсутствие, и какой снимок цены уходит в запись.
 *
 * Деньги целыми тиынами (ADR-008). Цена записи это **снимок на момент записи**, не ссылка на каталог:
 * прайс завтра поменяется, а записанный клиент придёт по вчерашней цене.
 */

import {
  effectiveService,
  fitsSchedule,
  type BeautyServiceRef,
  type LocationServiceRef,
  type TimeOffRef,
  type WorkingHoursRef,
} from './beauty';
import type { ParseResult } from './catalog';

const NAME_LIMIT = 100;
const PHONE_LIMIT = 32;
const NOTES_LIMIT = 2000;

/** Состояния записи, как в enum `AppointmentStatus` */
export type AppointmentStatus = 'BOOKED' | 'CONFIRMED' | 'DONE' | 'NO_SHOW' | 'CANCELLED';

/** Что уйдёт в строку `appointments` */
export interface AppointmentPlan {
  startsAt: Date;
  endsAt: Date;
  priceMinor: bigint;
  currency: string;
  durationMinutes: number;
}

/**
 * Можно ли записать и по какой цене. Отказ возвращается словами для человека, а не кодом:
 * на экране он стоит рядом с полем, как и в остальных формах стойки.
 */
export function planAppointment(input: {
  startsAt: Date;
  timezone: string;
  service: BeautyServiceRef;
  locationCurrency: string;
  locationService: LocationServiceRef | null;
  workingHours: readonly WorkingHoursRef[];
  timeOffs: readonly TimeOffRef[];
}): ParseResult<AppointmentPlan> {
  const { startsAt, timezone, service, locationCurrency, locationService } = input;

  const effective = effectiveService({ service, locationCurrency, locationService });
  if (!effective.sellable) {
    const reason =
      effective.reason === 'SERVICE_INACTIVE'
        ? 'Услуга в архиве'
        : effective.reason === 'NOT_ENABLED'
          ? 'Филиал эту услугу не оказывает'
          : 'У услуги нет цены в валюте филиала';
    return { ok: false, reason };
  }

  const endsAt = new Date(startsAt.getTime() + effective.durationMinutes * 60_000);
  const fit = fitsSchedule({
    startsAt,
    endsAt,
    timezone,
    workingHours: input.workingHours,
    timeOffs: input.timeOffs,
  });
  if (!fit.ok)
    return {
      ok: false,
      reason:
        fit.reason === 'TIME_OFF' ? 'У мастера в этот день отсутствие' : 'Мастер в это время не работает',
    };

  return {
    ok: true,
    value: {
      startsAt,
      endsAt,
      priceMinor: effective.priceMinor,
      currency: effective.currency,
      durationMinutes: effective.durationMinutes,
    },
  };
}

// ───────────── жизнь записи ─────────────

/**
 * Куда запись может перейти из текущего состояния.
 *
 * Выполненная, отменённая и незаезд это конец пути: вернуть их обратно нельзя. Так осторожнее, потому что
 * за выполненной записью стоят деньги, а решения по ним ещё нет (Q-252). Понадобится «вернуть» (ошиблись
 * кнопкой) это отдельное решение владельца, а не тихое послабление здесь.
 */
const NEXT: Record<AppointmentStatus, AppointmentStatus[]> = {
  BOOKED: ['CONFIRMED', 'DONE', 'NO_SHOW', 'CANCELLED'],
  CONFIRMED: ['DONE', 'NO_SHOW', 'CANCELLED'],
  DONE: [],
  NO_SHOW: [],
  CANCELLED: [],
};

export function nextStatuses(from: AppointmentStatus): AppointmentStatus[] {
  return NEXT[from] ?? [];
}

export function statusChange(
  from: AppointmentStatus,
  to: AppointmentStatus,
): { ok: true } | { ok: false; reason: string } {
  if (from === to) return { ok: false, reason: 'Запись уже в этом состоянии' };
  if (!nextStatuses(from).includes(to))
    return { ok: false, reason: 'Из этого состояния запись так не меняют' };
  return { ok: true };
}

// ───────────── разбор ввода ─────────────

/** Клиент записи: уже заведённый или новый, которого заводим вместе с записью */
export type AppointmentCustomer =
  | { kind: 'existing'; id: string }
  | { kind: 'new'; firstName: string; lastName: string | null; phone: string | null };

export interface AppointmentInput {
  employeeId: string;
  serviceId: string;
  startsAt: Date;
  customer: AppointmentCustomer;
  notes: string | null;
}

export function parseAppointmentInput(raw: unknown): ParseResult<AppointmentInput> {
  const body = (raw ?? {}) as Record<string, unknown>;

  const employeeId = text(body['employeeId']);
  if (!employeeId) return { ok: false, reason: 'Выберите мастера' };
  const serviceId = text(body['serviceId']);
  if (!serviceId) return { ok: false, reason: 'Выберите услугу' };

  const rawStart = text(body['startsAt']);
  if (!rawStart) return { ok: false, reason: 'Укажите время записи' };
  const startsAt = new Date(rawStart);
  if (Number.isNaN(startsAt.getTime())) return { ok: false, reason: 'Время записи не разобрать' };

  const customerId = text(body['customerId']);
  const firstName = text(body['firstName']);
  if (!customerId && !firstName) return { ok: false, reason: 'Выберите клиента или впишите имя' };
  if (firstName.length > NAME_LIMIT) return { ok: false, reason: `Имя клиента: не больше ${NAME_LIMIT} символов` };

  const lastName = text(body['lastName']);
  if (lastName.length > NAME_LIMIT)
    return { ok: false, reason: `Фамилия клиента: не больше ${NAME_LIMIT} символов` };
  const phone = text(body['phone']);
  if (phone.length > PHONE_LIMIT) return { ok: false, reason: `Телефон: не больше ${PHONE_LIMIT} символов` };

  const notes = text(body['notes']);
  if (notes.length > NOTES_LIMIT) return { ok: false, reason: 'Заметка слишком длинная' };

  return {
    ok: true,
    value: {
      employeeId,
      serviceId,
      startsAt,
      customer: customerId
        ? { kind: 'existing', id: customerId }
        : { kind: 'new', firstName, lastName: lastName || null, phone: phone || null },
      notes: notes || null,
    },
  };
}

function text(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : '';
}
