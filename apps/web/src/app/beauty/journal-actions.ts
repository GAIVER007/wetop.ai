'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, beautyApi } from '../../lib/api';

/**
 * Журнал записей салона (срез B5): создание записи, перенос и состояние.
 * Отказ API показывается словами, введённое в панели не стирается.
 */
export interface JournalResult {
  error?: string;
  message?: string;
}

const failed = (e: unknown, fallback: string): JournalResult => ({
  error: e instanceof ApiError ? e.message : fallback,
});

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
}

export async function createAppointment(
  _prev: JournalResult | null,
  form: FormData,
): Promise<JournalResult> {
  try {
    await beautyApi.createAppointment({
      employeeId: text(form, 'employeeId'),
      serviceId: text(form, 'serviceId'),
      startsAt: text(form, 'startsAt'),
      customerId: text(form, 'customerId'),
      firstName: text(form, 'firstName'),
      lastName: text(form, 'lastName'),
      phone: text(form, 'phone'),
      notes: text(form, 'notes'),
    });
    revalidatePath('/beauty');
    return { message: 'Запись создана' };
  } catch (e) {
    return failed(e, 'Не удалось создать запись. Обновите страницу перед повтором.');
  }
}

export async function moveAppointment(
  _prev: JournalResult | null,
  form: FormData,
): Promise<JournalResult> {
  try {
    await beautyApi.moveAppointment(text(form, 'id'), {
      employeeId: text(form, 'employeeId'),
      startsAt: text(form, 'startsAt'),
    });
    revalidatePath('/beauty');
    return { message: 'Запись перенесена' };
  } catch (e) {
    return failed(e, 'Не удалось перенести запись.');
  }
}

export async function setAppointmentStatus(id: string, status: string): Promise<JournalResult> {
  try {
    await beautyApi.setAppointmentStatus(id, status);
    revalidatePath('/beauty');
    return { message: 'Состояние записи изменено' };
  } catch (e) {
    return failed(e, 'Не удалось изменить состояние записи.');
  }
}
