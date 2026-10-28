'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, platformApi } from '../../../lib/api';
import { serverT } from '../../../i18n/server';
import { msg } from '../../../i18n';

/**
 * Деньги компании WETOP (DATA_MODEL §63): оплаты, расходы, тарифы, подписки и команда. Поля проверяет API, отказ
 * приходит его словами; после записи страницы кабинета перечитываются.
 */
export interface MoneyFormResult {
  error: string | null;
  message: string | null;
  attempt: number;
}

const field = (form: FormData, name: string) => String(form.get(name) ?? '').trim();

async function run(
  prev: MoneyFormResult | null,
  work: () => Promise<unknown>,
  done: string,
): Promise<MoneyFormResult> {
  const attempt = (prev?.attempt ?? 0) + 1;
  try {
    await work();
    revalidatePath('/platform/cabinet', 'layout');
    const t = await serverT();
    return { error: null, message: t(done), attempt };
  } catch (e) {
    const t = await serverT();
    return {
      error:
        e instanceof ApiError || e instanceof Error
          ? e.message
          : t('Не удалось сохранить, попробуйте ещё раз'),
      message: null,
      attempt,
    };
  }
}

export async function addPaymentAction(
  prev: MoneyFormResult | null,
  form: FormData,
): Promise<MoneyFormResult> {
  return run(
    prev,
    () =>
      platformApi.addPayment({
        organizationId: field(form, 'organizationId'),
        amount: field(form, 'amount'),
        paidOn: field(form, 'paidOn'),
        note: field(form, 'note'),
        extendMonths: Number(field(form, 'extendMonths') || '1'),
      }),
    msg('Оплата записана.'),
  );
}

export async function voidPaymentAction(
  id: string,
  prev: MoneyFormResult | null,
): Promise<MoneyFormResult> {
  return run(prev, () => platformApi.voidPayment(id), msg('Оплата отменена.'));
}

export async function addExpenseAction(
  prev: MoneyFormResult | null,
  form: FormData,
): Promise<MoneyFormResult> {
  return run(
    prev,
    () =>
      platformApi.addExpense({
        category: field(form, 'category'),
        amount: field(form, 'amount'),
        spentOn: field(form, 'spentOn'),
        note: field(form, 'note'),
      }),
    msg('Расход записан.'),
  );
}

export async function voidExpenseAction(
  id: string,
  prev: MoneyFormResult | null,
): Promise<MoneyFormResult> {
  return run(prev, () => platformApi.voidExpense(id), msg('Расход отменён.'));
}

export async function savePlanAction(
  id: string | null,
  prev: MoneyFormResult | null,
  form: FormData,
): Promise<MoneyFormResult> {
  return run(
    prev,
    () =>
      platformApi.savePlan(id, {
        name: field(form, 'name'),
        price: field(form, 'price'),
        periodMonths: field(form, 'periodMonths') === '12' ? 12 : 1,
        active: field(form, 'active') !== 'false',
      }),
    msg('Тариф сохранён.'),
  );
}

export async function saveSubscriptionAction(
  organizationId: string,
  prev: MoneyFormResult | null,
  form: FormData,
): Promise<MoneyFormResult> {
  return run(
    prev,
    () =>
      platformApi.saveSubscription(organizationId, {
        planId: field(form, 'planId') || null,
        monthly: field(form, 'monthly'),
        paidUntil: field(form, 'paidUntil') || null,
        note: field(form, 'note'),
      }),
    msg('Подписка сохранена.'),
  );
}

export async function saveTeamMemberAction(
  id: string | null,
  prev: MoneyFormResult | null,
  form: FormData,
): Promise<MoneyFormResult> {
  return run(
    prev,
    () =>
      platformApi.saveTeamMember(id, {
        name: field(form, 'name'),
        role: field(form, 'role'),
        email: field(form, 'email'),
        salary: field(form, 'salary'),
        active: field(form, 'active') !== 'false',
      }),
    msg('Сохранено.'),
  );
}
