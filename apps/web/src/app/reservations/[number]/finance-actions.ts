'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, financeApi } from '../../../lib/api';

export interface FinanceActionResult {
  error: string | null;
  /** метка последнего успешного действия — чтобы клиент мог сбросить форму */
  ok: number;
  /** что именно прошло: для денег молчание после успеха — худший ответ (§7.3) */
  message?: string;
  values?: Record<string, string>;
  attempt?: number;
}
/** Подписи полей формы: отказ API называет поле кодом (`amount — …`), администратор видит подпись */
const FIELD_LABELS: Record<string, string> = {
  amount: 'Сумма',
  method: 'Способ оплаты',
  note: 'Примечание',
  kind: 'Вид начисления',
  serviceCode: 'Услуга',
  description: 'Описание',
  quantity: 'Количество',
  unitPrice: 'Цена',
  serviceDate: 'Дата услуги',
  reason: 'Причина',
  allocations: 'Распределение по счетам',
  extra: 'Доплата',
};
const humanize = (message: string) => {
  const m = /^([A-Za-z]+) — (.+)$/s.exec(message);
  const label = m && FIELD_LABELS[m[1]!];
  return label ? `Поле «${label}»: ${m![2]}` : message;
};
const describe = (e: unknown) =>
  e instanceof ApiError ? humanize(e.message) : e instanceof Error ? e.message : String(e);
const s = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};
const rejected = (
  error: unknown,
  prev: FinanceActionResult,
  fd: FormData,
  keys: string[],
): FinanceActionResult => ({
  error: describe(error),
  ok: prev.ok,
  attempt: (prev.attempt ?? 0) + 1,
  values: Object.fromEntries(
    keys.map((key) => [key, typeof fd.get(key) === 'string' ? (fd.get(key) as string) : '']),
  ),
});
const done = (number: string, message?: string): FinanceActionResult => {
  revalidatePath(`/reservations/${number}`);
  return { error: null, ok: Date.now(), ...(message ? { message } : {}) };
};

/** «12500» → «12 500 ₸» (DESIGN.md §14); не число — возвращаем как ввели, без выдумок */
const money = (amount: string | undefined): string => {
  const n = Number((amount ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return `${amount ?? ''} ₸`.trim();
  return `${new Intl.NumberFormat('ru-RU').format(n)} ₸`;
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
    return rejected(e, _prev, fd, [
      'kind',
      'serviceCode',
      'description',
      'quantity',
      'unitPrice',
      'serviceDate',
    ]);
  }
  return done(number, 'Начисление добавлено в счёт.');
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
    return rejected(e, _prev, fd, ['method', 'amount', 'note']);
  }
  return done(number, `Оплата принята: ${money(s(fd, 'amount'))}. Баланс счёта ниже пересчитан.`);
}

/** Один платёж на выбранные открытые счета. Совпадение сумм проверяет существующий API. */
export async function payGroupAction(
  number: string,
  folioIds: string[],
  prev: FinanceActionResult,
  fd: FormData,
): Promise<FinanceActionResult> {
  const keys = ['method', 'amount', 'note', ...folioIds.map((id) => `allocation.${id}`)];
  const values = Object.fromEntries(keys.map((key) => [key, s(fd, key) ?? '']));
  try {
    await financeApi.pay({
      method: s(fd, 'method'),
      amount: s(fd, 'amount'),
      note: s(fd, 'note') ?? null,
      allocations: folioIds.flatMap((folioId) => {
        const amount = s(fd, `allocation.${folioId}`);
        return amount ? [{ folioId, amount }] : [];
      }),
    });
  } catch (e) {
    return { error: describe(e), ok: prev.ok, attempt: (prev.attempt ?? 0) + 1, values };
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
    return rejected(e, _prev, fd, ['amount', 'reason']);
  }
  return done(number);
}

/** DATA_MODEL §25: чек, пробитый в кассе по запросу гостя, отмечается номером у платежа */
export async function receiptAction(
  number: string,
  paymentId: string,
  _prev: FinanceActionResult,
  fd: FormData,
): Promise<FinanceActionResult> {
  try {
    await financeApi.issueReceipt(paymentId, s(fd, 'receipt') ?? '');
  } catch (e) {
    return rejected(e, _prev, fd, ['receipt']);
  }
  return done(number);
}

/** ADR-021: ранний заезд / поздний выезд — услуга на счёте, половина ночи по умолчанию */
export async function stayExtraAction(
  number: string,
  folioId: string,
  extra: 'EARLY_CHECK_IN' | 'LATE_CHECK_OUT',
  time?: string,
): Promise<FinanceActionResult> {
  try {
    await financeApi.addStayExtra(folioId, extra, time);
  } catch (e) {
    return { error: describe(e), ok: 0 };
  }
  return done(number);
}

/** Запрос оплаты (DATA_MODEL §23, ADR-141): счёт Kaspi по телефону, ссылка банка или перевод */
export async function createPaymentRequestAction(
  number: string,
  prev: FinanceActionResult,
  fd: FormData,
): Promise<FinanceActionResult> {
  try {
    await financeApi.createPaymentRequest(number, {
      folioId: s(fd, 'folioId'),
      method: s(fd, 'method'),
      amount: s(fd, 'amount'),
      link: s(fd, 'link') ?? null,
      note: s(fd, 'note') ?? null,
    });
  } catch (e) {
    return rejected(e, prev, fd, ['folioId', 'method', 'amount', 'link', 'note']);
  }
  return done(number, `Запрос на ${money(s(fd, 'amount'))} создан. Отправьте гостю текст ниже.`);
}

/** «Оплачено»: запрос превращается в обычный платёж на счёт проживания одной транзакцией */
export async function markPaymentRequestPaidAction(
  number: string,
  id: string,
  prev: FinanceActionResult,
): Promise<FinanceActionResult> {
  try {
    await financeApi.markPaymentRequestPaid(id);
  } catch (e) {
    return { error: describe(e), ok: prev.ok, attempt: (prev.attempt ?? 0) + 1 };
  }
  return done(number, 'Оплата по запросу принята, баланс счёта пересчитан.');
}

export async function cancelPaymentRequestAction(
  number: string,
  id: string,
  prev: FinanceActionResult,
): Promise<FinanceActionResult> {
  try {
    await financeApi.cancelPaymentRequest(id);
  } catch (e) {
    return { error: describe(e), ok: prev.ok, attempt: (prev.attempt ?? 0) + 1 };
  }
  return done(number, 'Запрос отменён.');
}
