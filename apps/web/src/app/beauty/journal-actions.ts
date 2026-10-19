'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, authApi, beautyApi } from '../../lib/api';

/**
 * Журнал записей салона (срез B5): создание записи, перенос и состояние.
 * Отказ API показывается словами, введённое в панели не стирается.
 */
export interface JournalResult {
  outcome?: 'rejected' | 'unknown';
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
  // The initial scope is a guard, never an authority. API still checks all permissions.
  try {
    const expected = JSON.parse(text(form, 'scopeKey')) as Record<string, unknown>;
    const me = await authApi.me();
    if (!expected.organizationId || !expected.businessId || !expected.locationId ||
      me.user?.organizationId !== expected.organizationId ||
      me.context?.businessId !== expected.businessId || me.context?.locationId !== expected.locationId)
      return { outcome: 'rejected', error: 'Контекст изменён. Закройте старую форму и откройте запись в нужном филиале. Ввод сохранён.' };
  } catch {
    return { outcome: 'rejected', error: 'Не удалось проверить исходный контекст. Ввод сохранён, команда не отправлена.' };
  }
  try {
    const saved = await beautyApi.createAppointment({
      employeeId: text(form, 'employeeId'),
      serviceId: text(form, 'serviceId'),
      startsAt: text(form, 'startsAt'),
      customerId: text(form, 'customerId'),
      firstName: text(form, 'firstName'),
      lastName: text(form, 'lastName'),
      phone: text(form, 'phone'),
      notes: text(form, 'notes'),
    });
    if (!saved?.appointments?.some((row) => typeof row.id === 'string' && row.id))
      return { outcome: 'unknown', error: 'Результат не подтверждён. Проверьте список записей перед повторным созданием.' };
    revalidatePath('/calendar');
    revalidatePath('/appointments');
    revalidatePath('/employees');
    revalidatePath('/services');
    revalidatePath('/customers');
    revalidatePath('/beauty');
    return { message: 'Запись создана' };
  } catch (e) {
    return e instanceof ApiError && e.status >= 400 && e.status < 500
      ? { outcome: 'rejected', error: e.message }
      : { outcome: 'unknown', error: 'Результат не подтверждён. Проверьте список записей перед повторным созданием. Автоматического повтора нет.' };
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
    revalidatePath('/calendar');
    revalidatePath('/appointments');
    revalidatePath('/employees');
    revalidatePath('/services');
    revalidatePath('/customers');
    revalidatePath('/beauty');
    return { message: 'Запись перенесена' };
  } catch (e) {
    return failed(e, 'Не удалось перенести запись.');
  }
}

// Stale-form guard only. API remains the authority for organization/permissions.
async function moneyScopeMatches(scope: string): Promise<boolean> {
  try {
    const expected = JSON.parse(scope) as Record<string, unknown>;
    const me = await authApi.me();
    return Boolean(expected.organizationId && expected.businessId && expected.locationId &&
      me.user?.organizationId === expected.organizationId &&
      me.context?.businessId === expected.businessId && me.context?.locationId === expected.locationId);
  } catch { return false; }
}
const unknownMoneyResult = (): JournalResult => ({
  outcome: 'unknown',
  error: 'Результат операции не подтверждён. Не создавайте новую оплату или возврат. Повторите ту же операцию либо сверьте историю и кассу.',
});
function moneyRevalidate() {
  try {
    revalidatePath('/calendar');
    revalidatePath('/appointments');
    revalidatePath('/cashbox');
  } catch {
    // API already confirmed the mutation. A cache failure is not a failed payment.
  }
}

/** One key per intentional operation, including its identical retries. Amount in minor units. */
export async function payAppointment(
  id: string,
  method: string,
  amountMinor: number,
  idempotencyKey: string,
  scope: string,
): Promise<JournalResult> {
  if (!(await moneyScopeMatches(scope)))
    return { outcome: 'rejected', error: 'Не удалось подтвердить исходный филиал. Команда не отправлена.' };
  try {
    const saved = await beautyApi.payAppointment(id, { method, amount: amountMinor, idempotencyKey });
    if (!Array.isArray(saved?.appointments) || !saved.appointments.some((row) => row.id === id))
      return unknownMoneyResult();
    moneyRevalidate();
    return { message: 'Оплата принята' };
  } catch {
    return unknownMoneyResult();
  }
}

/** Возврат по выполненной записи (§54): расход кассы филиала с причиной */
export async function refundAppointment(
  id: string,
  method: string,
  amountMinor: number,
  reason: string,
  idempotencyKey: string,
  scope: string,
): Promise<JournalResult> {
  if (!(await moneyScopeMatches(scope)))
    return { outcome: 'rejected', error: 'Не удалось подтвердить исходный филиал. Команда не отправлена.' };
  try {
    const saved = await beautyApi.refundAppointment(id, { method, amount: amountMinor, reason, idempotencyKey });
    if (!Array.isArray(saved?.appointments) || !saved.appointments.some((row) => row.id === id))
      return unknownMoneyResult();
    moneyRevalidate();
    return { message: 'Возврат оформлен' };
  } catch {
    return unknownMoneyResult();
  }
}

export async function setAppointmentStatus(id: string, status: string): Promise<JournalResult> {
  try {
    await beautyApi.setAppointmentStatus(id, status);
    revalidatePath('/calendar');
    revalidatePath('/appointments');
    revalidatePath('/employees');
    revalidatePath('/services');
    revalidatePath('/customers');
    revalidatePath('/beauty');
    return { message: 'Состояние записи изменено' };
  } catch (e) {
    return failed(e, 'Не удалось изменить состояние записи.');
  }
}
