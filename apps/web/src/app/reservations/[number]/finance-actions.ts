'use server';
import { revalidatePath } from 'next/cache';
import { FinanceRuleError, discountMinor, parseMoney } from '@pms/domain';
import { ApiError, financeApi, reservationsApi } from '../../../lib/api';
import { currencySign } from '../../../lib/money';
import { msg, type Translate } from '../../../i18n';
import { serverT } from '../../../i18n/server';

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
  amount: msg('Сумма'),
  method: msg('Способ оплаты'),
  note: msg('Примечание'),
  kind: msg('Вид начисления@@счёт'),
  serviceCode: msg('Услуга'),
  description: msg('Описание'),
  quantity: msg('Количество'),
  unitPrice: msg('Цена'),
  serviceDate: msg('Дата услуги'),
  reason: msg('Причина'),
  allocations: msg('Распределение по счетам'),
  extra: msg('Доплата'),
  price: msg('Цена проживания'),
  percent: msg('Процент скидки'),
};
const humanize = (message: string, t: Translate) => {
  const m = /^([A-Za-z]+) — (.+)$/s.exec(message);
  const label = m && FIELD_LABELS[m[1]!];
  return label ? t('Поле «{label}»: {message}', { label: t(label), message: t(m![2]!) }) : t(message);
};
const describe = (e: unknown, t: Translate) =>
  e instanceof ApiError || e instanceof FinanceRuleError
    ? humanize(e.message, t)
    : e instanceof Error
      ? t(e.message)
      : String(e);
const s = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};
const rejected = (
  error: unknown,
  prev: FinanceActionResult,
  fd: FormData,
  keys: string[],
  t: Translate,
): FinanceActionResult => ({
  error: describe(error, t),
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

/**
 * «12500» → «12 500 ₸» (DESIGN.md §14); не число — возвращаем как ввели, без выдумок. Валюта счёта из скрытого
 * поля формы `currency` (решение владельца 20.10.2026: суммы в валюте объекта); нет поля — тенге, как раньше.
 * Только подпись сообщения: число для API не пересчитывается.
 */
const money = (amount: string | undefined, currency?: string): string => {
  const sign = currencySign(currency && /^[A-Z]{3}$/.test(currency) ? currency : 'KZT');
  const n = Number((amount ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return `${amount ?? ''} ${sign}`.trim();
  return `${new Intl.NumberFormat('ru-RU').format(n)} ${sign}`;
};

/** Тиыны → строка денег для API («-123450» → «-1234.50») */
const minorToDecimal = (minor: bigint): string => {
  const neg = minor < 0n;
  const d = (neg ? -minor : minor).toString().padStart(3, '0');
  return `${neg ? '-' : ''}${d.slice(0, -2)}.${d.slice(-2)}`;
};

/**
 * Скидка (план finance-payments-direct 07.10.2026, У7): отрицательная корректировка с понятной подписью. Процент
 * считается от действующего начисления за проживание (`baseMinor` из формы) правилом домена, целыми тиынами.
 */
function discountCharge(fd: FormData): {
  description: string;
  unitPrice: string;
} {
  const percentRaw = s(fd, 'percent');
  const amountRaw = s(fd, 'amount');
  const reason = s(fd, 'description');
  let minor: bigint;
  let description: string;
  if (percentRaw) {
    const percent = Number(percentRaw.replace(',', '.'));
    if (!Number.isInteger(percent)) throw new FinanceRuleError(`percent — ${msg('целое число от 1 до 100')}`);
    minor = discountMinor(BigInt(s(fd, 'baseMinor') ?? '0'), percent);
    description = `Скидка ${percent}% на проживание${reason ? `: ${reason}` : ''}`; // kk-allow: подпись начисления хранится в счёте и печатается
  } else if (amountRaw) {
    minor = parseMoney(amountRaw);
    description = `Скидка${reason ? `: ${reason}` : ''}`; // kk-allow: подпись начисления хранится в счёте и печатается
  } else {
    throw new FinanceRuleError(`percent — ${msg('процент скидки или amount — её сумма')}`);
  }
  if (minor <= 0n) throw new FinanceRuleError(`amount — ${msg('скидка должна быть больше нуля')}`);
  return { description, unitPrice: minorToDecimal(-minor) };
}

export async function addChargeAction(
  number: string,
  folioId: string,
  _prev: FinanceActionResult,
  fd: FormData,
): Promise<FinanceActionResult> {
  const t = await serverT();
  const kind = s(fd, 'kind');
  const keys = [
    'kind',
    'serviceCode',
    'description',
    'quantity',
    'unitPrice',
    'serviceDate',
    'percent',
    'amount',
  ];
  try {
    if (kind === 'DISCOUNT') {
      const discount = discountCharge(fd);
      await financeApi.addCharge(folioId, {
        kind: 'ADJUSTMENT',
        description: discount.description,
        quantity: '1',
        unitPrice: discount.unitPrice,
        serviceDate: s(fd, 'serviceDate'),
      });
      return done(number, t('Скидка записана в счёт.'));
    }
    await financeApi.addCharge(folioId, {
      kind,
      serviceCode: s(fd, 'serviceCode'),
      description: s(fd, 'description'),
      quantity: s(fd, 'quantity'),
      unitPrice: s(fd, 'unitPrice'),
      serviceDate: s(fd, 'serviceDate'),
    });
  } catch (e) {
    return rejected(e, _prev, fd, keys, t);
  }
  return done(number, t('Начисление добавлено в счёт.'));
}

/** Цена проживания целиком (У6): начисление переписывает система, при смене дат цена снова по тарифу */
export async function stayPriceAction(
  number: string,
  itemId: string,
  _prev: FinanceActionResult,
  fd: FormData,
): Promise<FinanceActionResult> {
  const t = await serverT();
  try {
    await reservationsApi.updateItem(number, itemId, { price: s(fd, 'price') ?? '' });
  } catch (e) {
    return rejected(e, _prev, fd, ['price'], t);
  }
  revalidatePath('/chessboard');
  return done(number, t('Цена проживания изменена: {sum}. Счёт ниже пересчитан.', { sum: money(s(fd, 'price'), s(fd, 'currency')) }));
}

/** Аннулировать платёж (У1–У4): деньги уходят из оплаченного, строка остаётся со статусом «аннулирован» */
export async function voidPaymentAction(
  number: string,
  paymentId: string,
  reason: string | null,
): Promise<FinanceActionResult> {
  const t = await serverT();
  try {
    await financeApi.voidPayment(paymentId, reason);
  } catch (e) {
    return { error: describe(e, t), ok: 0 };
  }
  revalidatePath('/finance');
  return done(number, t('Платёж аннулирован. Баланс счёта ниже пересчитан.'));
}

/** Заменить платёж: поправили способ, сумму или примечание; дата платежа остаётся прежней */
export async function replacePaymentAction(
  number: string,
  paymentId: string,
  _prev: FinanceActionResult,
  fd: FormData,
): Promise<FinanceActionResult> {
  const t = await serverT();
  try {
    await financeApi.replacePayment(paymentId, {
      method: s(fd, 'method'),
      amount: s(fd, 'amount'),
      note: s(fd, 'note') ?? null,
    });
  } catch (e) {
    return rejected(e, _prev, fd, ['method', 'amount', 'note'], t);
  }
  revalidatePath('/finance');
  return done(
    number,
    t('Платёж изменён: {sum}. Прежний остался в списке аннулированным.', { sum: money(s(fd, 'amount'), s(fd, 'currency')) }),
  );
}
export async function voidChargeAction(
  number: string,
  chargeId: string,
): Promise<FinanceActionResult> {
  const t = await serverT();
  try {
    await financeApi.voidCharge(chargeId);
  } catch (e) {
    return { error: describe(e, t), ok: 0 };
  }
  return done(number);
}
/** Ручное закрытие счёта — API откажет, если баланс не нулевой. */
export async function closeFolioAction(
  number: string,
  folioId: string,
): Promise<FinanceActionResult> {
  const t = await serverT();
  try {
    await financeApi.closeFolio(folioId);
  } catch (e) {
    return { error: describe(e, t), ok: 0 };
  }
  return done(number);
}
export async function payAction(
  number: string,
  folioId: string,
  _prev: FinanceActionResult,
  fd: FormData,
): Promise<FinanceActionResult> {
  const t = await serverT();
  try {
    const amount = s(fd, 'amount');
    await financeApi.pay({
      method: s(fd, 'method'),
      amount,
      note: s(fd, 'note') ?? null,
      allocations: [{ folioId, amount }],
    });
  } catch (e) {
    return rejected(e, _prev, fd, ['method', 'amount', 'note'], t);
  }
  return done(number, t('Оплата принята: {sum}. Баланс счёта ниже пересчитан.', { sum: money(s(fd, 'amount'), s(fd, 'currency')) }));
}

/** Один платёж на выбранные открытые счета. Совпадение сумм проверяет существующий API. */
export async function payGroupAction(
  number: string,
  folioIds: string[],
  prev: FinanceActionResult,
  fd: FormData,
): Promise<FinanceActionResult> {
  const t = await serverT();
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
    return { error: describe(e, t), ok: prev.ok, attempt: (prev.attempt ?? 0) + 1, values };
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
  const t = await serverT();
  try {
    await financeApi.refund(paymentId, {
      folioId,
      amount: s(fd, 'amount'),
      reason: s(fd, 'reason') ?? null,
    });
  } catch (e) {
    return rejected(e, _prev, fd, ['amount', 'reason'], t);
  }
  return done(number);
}

/** DATA_MODEL §26: чек, пробитый в кассе по запросу гостя, отмечается номером у платежа */
export async function receiptAction(
  number: string,
  paymentId: string,
  _prev: FinanceActionResult,
  fd: FormData,
): Promise<FinanceActionResult> {
  const t = await serverT();
  try {
    await financeApi.issueReceipt(paymentId, s(fd, 'receipt') ?? '');
  } catch (e) {
    return rejected(e, _prev, fd, ['receipt'], t);
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
  const t = await serverT();
  try {
    await financeApi.addStayExtra(folioId, extra, time);
  } catch (e) {
    return { error: describe(e, t), ok: 0 };
  }
  return done(number);
}

/** Запрос оплаты (DATA_MODEL §24, ADR-144): счёт Kaspi по телефону, ссылка банка или перевод */
export async function createPaymentRequestAction(
  number: string,
  prev: FinanceActionResult,
  fd: FormData,
): Promise<FinanceActionResult> {
  const t = await serverT();
  try {
    await financeApi.createPaymentRequest(number, {
      folioId: s(fd, 'folioId'),
      method: s(fd, 'method'),
      amount: s(fd, 'amount'),
      link: s(fd, 'link') ?? null,
      note: s(fd, 'note') ?? null,
    });
  } catch (e) {
    return rejected(e, prev, fd, ['folioId', 'method', 'amount', 'link', 'note'], t);
  }
  return done(number, t('Запрос на {sum} создан. Отправьте гостю текст ниже.', { sum: money(s(fd, 'amount'), s(fd, 'currency')) }));
}

/** «Оплачено»: запрос превращается в обычный платёж на счёт проживания одной транзакцией */
export async function markPaymentRequestPaidAction(
  number: string,
  id: string,
  prev: FinanceActionResult,
): Promise<FinanceActionResult> {
  const t = await serverT();
  try {
    await financeApi.markPaymentRequestPaid(id);
  } catch (e) {
    return { error: describe(e, t), ok: prev.ok, attempt: (prev.attempt ?? 0) + 1 };
  }
  return done(number, t('Оплата по запросу принята, баланс счёта пересчитан.'));
}

export async function cancelPaymentRequestAction(
  number: string,
  id: string,
  prev: FinanceActionResult,
): Promise<FinanceActionResult> {
  const t = await serverT();
  try {
    await financeApi.cancelPaymentRequest(id);
  } catch (e) {
    return { error: describe(e, t), ok: prev.ok, attempt: (prev.attempt ?? 0) + 1 };
  }
  return done(number, t('Запрос отменён.'));
}
