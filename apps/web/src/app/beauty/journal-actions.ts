'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, authApi, beautyApi, type BeautyAppointmentRow } from '../../lib/api';
import { MAX_PERIOD_DAYS, periodDays } from '../../components/quick-report-period';
import type { Translate } from '../../i18n';
import { serverT } from '../../i18n/server';

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
  const t = await serverT();
  // The initial scope is a guard, never an authority. API still checks all permissions.
  try {
    const expected = JSON.parse(text(form, 'scopeKey')) as Record<string, unknown>;
    const me = await authApi.me();
    if (
      !expected.organizationId ||
      !expected.businessId ||
      !expected.locationId ||
      me.user?.organizationId !== expected.organizationId ||
      me.context?.businessId !== expected.businessId ||
      me.context?.locationId !== expected.locationId
    )
      return {
        outcome: 'rejected',
        error:
          t('Контекст изменён. Закройте старую форму и откройте запись в нужном филиале. Ввод сохранён.'),
      };
  } catch {
    return {
      outcome: 'rejected',
      error: t('Не удалось проверить исходный контекст. Ввод сохранён, команда не отправлена.'),
    };
  }
  let selection: Record<string, unknown> = {
    employeeId: text(form, 'employeeId'),
    serviceId: text(form, 'serviceId'),
  };
  if (form.has('items')) {
    try {
      const items: unknown = JSON.parse(text(form, 'items'));
      if (
        !Array.isArray(items) ||
        !items.length ||
        items.some(
          (item) =>
            !item ||
            typeof item !== 'object' ||
            typeof item.employeeId !== 'string' ||
            !item.employeeId ||
            typeof item.serviceId !== 'string' ||
            !item.serviceId,
        )
      )
        throw new Error('items');
      selection = { items };
    } catch {
      return {
        outcome: 'rejected',
        error: t('Проверьте список услуг и мастеров. Ввод сохранён, команда не отправлена.'),
      };
    }
  }
  try {
    const saved = await beautyApi.createAppointment({
      ...selection,
      startsAt: text(form, 'startsAt'),
      customerId: text(form, 'customerId'),
      firstName: text(form, 'firstName'),
      lastName: text(form, 'lastName'),
      phone: text(form, 'phone'),
      notes: text(form, 'notes'),
      atHome: text(form, 'atHome'),
      homeAddress: text(form, 'homeAddress'),
    });
    if (!saved?.appointments?.some((row) => typeof row.id === 'string' && row.id))
      return {
        outcome: 'unknown',
        error: t('Результат не подтверждён. Проверьте список записей перед повторным созданием.'),
      };
    revalidatePath('/calendar');
    revalidatePath('/appointments');
    revalidatePath('/employees');
    revalidatePath('/services');
    revalidatePath('/customers');
    revalidatePath('/beauty');
    return { message: t('Запись создана') };
  } catch (e) {
    return e instanceof ApiError && e.status >= 400 && e.status < 500
      ? { outcome: 'rejected', error: e.message }
      : {
          outcome: 'unknown',
          error:
            t('Результат не подтверждён. Проверьте список записей перед повторным созданием. Автоматического повтора нет.'),
        };
  }
}

export async function moveAppointment(
  _prev: JournalResult | null,
  form: FormData,
): Promise<JournalResult> {
  const t = await serverT();
  try {
    let changes: Record<string, unknown> = { employeeId: text(form, 'employeeId') };
    if (form.has('items')) {
      const items: unknown = JSON.parse(text(form, 'items'));
      if (
        !Array.isArray(items) ||
        !items.length ||
        items.some(
          (item) => !item || typeof item !== 'object' || !item.employeeId || !item.serviceId,
        )
      )
        return { outcome: 'rejected', error: t('Проверьте услуги и мастеров.') };
      // выезд на дом шлём всегда: снятая галочка приходит пустой и стирает адрес
      changes = { items, notes: text(form, 'notes'), atHome: text(form, 'atHome'), homeAddress: text(form, 'homeAddress') };
    }
    await beautyApi.moveAppointment(text(form, 'id'), {
      ...changes,
      startsAt: text(form, 'startsAt'),
    });
    revalidatePath('/calendar');
    revalidatePath('/appointments');
    revalidatePath('/employees');
    revalidatePath('/services');
    revalidatePath('/customers');
    revalidatePath('/beauty');
    return { message: t('Запись перенесена') };
  } catch (e) {
    return failed(e, t('Не удалось перенести запись.'));
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
const unknownMoneyResult = (t: Translate): JournalResult => ({
  outcome: 'unknown',
  error: t('Результат операции не подтверждён. Не создавайте новую оплату или возврат. Повторите ту же операцию либо сверьте историю и кассу.'),
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
  certificateCode?: string,
): Promise<JournalResult> {
  const t = await serverT();
  if (!(await moneyScopeMatches(scope)))
    return { outcome: 'rejected', error: t('Не удалось подтвердить исходный филиал. Команда не отправлена.') };
  try {
    const saved = await beautyApi.payAppointment(id, {
      method, amount: amountMinor, idempotencyKey, ...(certificateCode ? { certificateCode } : {}),
    });
    if (!Array.isArray(saved?.appointments) || !saved.appointments.some((row) => row.id === id))
      return unknownMoneyResult(t);
    moneyRevalidate();
    return { message: t('Оплата принята') };
  } catch (e) {
    // бонусы и сертификат: явный отказ API (лимит, срок, код) значит ничего не записано, причину видно сразу
    if (LOYALTY_METHODS.has(method) && e instanceof ApiError && [400, 404, 409].includes(e.status))
      return { outcome: 'rejected', error: e.message };
    return unknownMoneyResult(t);
  }
}

const LOYALTY_METHODS = new Set(['BONUS', 'GIFT_CERTIFICATE']);

/** Баланс бонусов клиента для формы оплаты; null: программа выключена или ответа нет */
export async function customerBonusQuote(customerId: string): Promise<{ balanceMinor: string; maxRedeemPercent: number } | null> {
  try {
    const b = await beautyApi.customerBonuses(customerId);
    return b.program.enabled ? { balanceMinor: b.balanceMinor, maxRedeemPercent: b.program.maxRedeemPercent } : null;
  } catch {
    return null;
  }
}

/** Остаток сертификата по коду для формы оплаты */
export async function lookupCertificate(code: string): Promise<{ balanceMinor: string; status: string; expiresAt: string } | { error: string }> {
  const t = await serverT();
  try {
    const c = await beautyApi.giftCertificateLookup(code);
    return { balanceMinor: c.balanceMinor, status: c.status, expiresAt: c.expiresAt };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : t('Не удалось проверить сертификат') };
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
  const t = await serverT();
  if (!(await moneyScopeMatches(scope)))
    return { outcome: 'rejected', error: t('Не удалось подтвердить исходный филиал. Команда не отправлена.') };
  try {
    const saved = await beautyApi.refundAppointment(id, { method, amount: amountMinor, reason, idempotencyKey });
    if (!Array.isArray(saved?.appointments) || !saved.appointments.some((row) => row.id === id))
      return unknownMoneyResult(t);
    moneyRevalidate();
    return { message: t('Возврат оформлен') };
  } catch {
    return unknownMoneyResult(t);
  }
}

export async function setAppointmentStatus(id: string, status: string): Promise<JournalResult> {
  const t = await serverT();
  try {
    await beautyApi.setAppointmentStatus(id, status);
    revalidatePath('/calendar');
    revalidatePath('/appointments');
    revalidatePath('/employees');
    revalidatePath('/services');
    revalidatePath('/customers');
    revalidatePath('/beauty');
    return { message: t('Состояние записи изменено') };
  } catch (e) {
    return failed(e, t('Не удалось изменить состояние записи.'));
  }
}

/**
 * Записи салона за период для быстрого отчёта: журнал отдаёт только день, поэтому дни читаются по
 * очереди пачками. Период ограничен (`MAX_PERIOD_DAYS`), чтобы отчёт не превращался в выгрузку.
 */
export async function beautyPeriodRows(
  from: string,
  to: string,
): Promise<{ rows?: BeautyAppointmentRow[]; error?: string }> {
  const t = await serverT();
  const days = periodDays(from, to);
  if (!days) return { error: t('Выберите период не длиннее {n} дней.', { n: MAX_PERIOD_DAYS }) };
  try {
    const rows: BeautyAppointmentRow[] = [];
    for (let i = 0; i < days.length; i += 8) {
      const chunk = await Promise.all(days.slice(i, i + 8).map((day) => beautyApi.day(day)));
      for (const day of chunk) rows.push(...day.appointments);
    }
    return { rows };
  } catch (e) {
    return failed(e, t('Не удалось загрузить записи за период. Повторите попытку.'));
  }
}
