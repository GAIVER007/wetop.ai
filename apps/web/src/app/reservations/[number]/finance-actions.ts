'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, financeApi } from '../../../lib/api';

export interface FinanceActionResult {
  error: string | null;
  /** метка последнего успешного действия — чтобы клиент мог сбросить форму */
  ok: number;
}
const describe = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);
const s = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};
const done = (number: string): FinanceActionResult => {
  revalidatePath(`/reservations/${number}`);
  return { error: null, ok: Date.now() };
};

export async function addChargeAction(
  number: string,
  folioId: string,
  _prev: FinanceActionResult,
  fd: FormData,
): Promise<FinanceActionResult> {
  try {
    await financeApi.addCharge(folioId, {
      kind: s(fd, 'kind'),
      serviceCode: s(fd, 'serviceCode'),
      description: s(fd, 'description'),
      quantity: s(fd, 'quantity'),
      unitPrice: s(fd, 'unitPrice'),
      serviceDate: s(fd, 'serviceDate'),
    });
  } catch (e) {
    return { error: describe(e), ok: _prev.ok };
  }
  return done(number);
}
export async function voidChargeAction(
  number: string,
  chargeId: string,
): Promise<FinanceActionResult> {
  try {
    await financeApi.voidCharge(chargeId);
  } catch (e) {
    return { error: describe(e), ok: 0 };
  }
  return done(number);
}
/** Ручное закрытие счёта — API откажет, если баланс не нулевой. */
export async function closeFolioAction(
  number: string,
  folioId: string,
): Promise<FinanceActionResult> {
  try {
    await financeApi.closeFolio(folioId);
  } catch (e) {
    return { error: describe(e), ok: 0 };
  }
  return done(number);
}
export async function payAction(
  number: string,
  folioId: string,
  _prev: FinanceActionResult,
  fd: FormData,
): Promise<FinanceActionResult> {
  try {
    const amount = s(fd, 'amount');
    await financeApi.pay({
      method: s(fd, 'method'),
      amount,
      note: s(fd, 'note') ?? null,
      allocations: [{ folioId, amount }],
    });
  } catch (e) {
    return { error: describe(e), ok: _prev.ok };
  }
  return done(number);
}
export async function refundAction(
  number: string,
  paymentId: string,
  folioId: string,
  _prev: FinanceActionResult,
  fd: FormData,
): Promise<FinanceActionResult> {
  try {
    await financeApi.refund(paymentId, {
      folioId,
      amount: s(fd, 'amount'),
      reason: s(fd, 'reason') ?? null,
    });
  } catch (e) {
    return { error: describe(e), ok: _prev.ok };
  }
  return done(number);
}
