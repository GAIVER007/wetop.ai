'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, financeApi } from '../../lib/api';
import { msg } from '../../i18n';
import { serverT } from '../../i18n/server';

/** Результат действия кассы (§21): ошибка словами у формы, введённое не теряется */
export interface CashActionResult {
  error: string | null;
  /** метка успеха — клиент закрывает панель и показывает «✓» */
  ok: number;
  message?: string;
}

const FIELD_LABELS: Record<string, string> = {
  amount: msg('Сумма'),
  method: msg('Способ'),
  from: msg('Откуда'),
  to: msg('Куда'),
  categoryId: msg('Статья'),
  note: msg('Комментарий'),
  name: msg('Название статьи'),
  kind: msg('Тип'),
};
const humanize = async (message: string) => {
  const t = await serverT();
  const m = /^([A-Za-z.]+) — (.+)$/s.exec(message);
  const label = m && FIELD_LABELS[m[1]!.replace('commission.', '')];
  return label ? t('Поле «{label}»: {message}', { label: t(label), message: m![2]! }) : message;
};
const describe = async (e: unknown) =>
  e instanceof ApiError ? await humanize(e.message) : e instanceof Error ? e.message : String(e);
const s = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};
const done = async (message: string): Promise<CashActionResult> => {
  revalidatePath('/finance');
  const t = await serverT();
  return { error: null, ok: Date.now(), message: t(message) };
};

/** Комиссия из формы: сумма или процент; пустые поля — комиссии нет */
function commissionOf(fd: FormData) {
  const amount = s(fd, 'commissionAmount');
  const percent = s(fd, 'commissionPercent');
  if (amount === undefined && percent === undefined) return undefined;
  return amount !== undefined ? { amount } : { percent };
}

/** Поступление или расход мимо счетов гостей; оплату брони принимают на счёте брони */
export async function cashOperationAction(
  _prev: CashActionResult,
  fd: FormData,
): Promise<CashActionResult> {
  // своя проверка вместо браузерной «Please fill out this field.» (аудит 22.10.2026 P1-23)
  if (!s(fd, 'amount')) {
    const t = await serverT();
    return { error: t('Укажите сумму'), ok: _prev.ok };
  }
  try {
    await financeApi.createCashOperation({
      ...(s(fd, 'idempotencyKey') ? {idempotencyKey:s(fd, 'idempotencyKey')} : {}),
      kind: s(fd, 'kind'),
      method: s(fd, 'method'),
      amount: s(fd, 'amount'),
      ...(s(fd, 'categoryId') ? { categoryId: s(fd, 'categoryId') } : {}),
      note: s(fd, 'note') ?? null,
      ...(commissionOf(fd) ? { commission: commissionOf(fd) } : {}),
    });
  } catch (e) {
    return { error: await describe(e), ok: _prev.ok };
  }
  return done(s(fd, 'kind') === 'EXPENSE' ? msg('Расход записан.') : msg('Поступление записано.'));
}

export async function cashTransferAction(
  _prev: CashActionResult,
  fd: FormData,
): Promise<CashActionResult> {
  if (!s(fd, 'amount')) {
    const t = await serverT();
    return { error: t('Укажите сумму'), ok: _prev.ok };
  }
  try {
    await financeApi.createCashTransfer({
      ...(s(fd, 'idempotencyKey') ? {idempotencyKey:s(fd, 'idempotencyKey')} : {}),
      from: s(fd, 'from'),
      to: s(fd, 'to'),
      amount: s(fd, 'amount'),
      note: s(fd, 'note') ?? null,
      ...(commissionOf(fd) ? { commission: commissionOf(fd) } : {}),
    });
  } catch (e) {
    return { error: await describe(e), ok: _prev.ok };
  }
  return done(msg('Перевод записан.'));
}

/** Сверка кассы (§21.4): снимок «по системе» и факт; расхождение — поправкой по галочке */
export async function cashReconcileAction(
  _prev: CashActionResult,
  fd: FormData,
): Promise<CashActionResult> {
  if (!s(fd, 'counted')) {
    const t = await serverT();
    return { error: t('Укажите пересчитанную сумму'), ok: _prev.ok };
  }
  try {
    await financeApi.createCashReconciliation({
      ...(s(fd, 'idempotencyKey') ? {idempotencyKey:s(fd, 'idempotencyKey')} : {}),
      method: s(fd, 'method'),
      counted: s(fd, 'counted'),
      note: s(fd, 'note') ?? null,
      adjust: fd.get('adjust') === 'on',
    });
  } catch (e) {
    return { error: await describe(e), ok: _prev.ok };
  }
  return done(msg('Сверка записана.'));
}

/** Аннулирование операции кассы (право как у возврата): комиссия снимается вместе с основной */
export async function voidCashOperationAction(id: string): Promise<CashActionResult> {
  try {
    await financeApi.voidCashOperation(id);
  } catch (e) {
    return { error: await describe(e), ok: 0 };
  }
  return done(msg('Операция аннулирована.'));
}

/** Аннулировать платёж гостя из ленты операций (план finance-payments-direct 07.10.2026): без возвратов и чека */
export async function voidPaymentAction(id: string): Promise<CashActionResult> {
  try {
    await financeApi.voidPayment(id, null);
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : String(e), ok: 0 };
  }
  revalidatePath('/finance');
  const t = await serverT();
  return { error: null, ok: Date.now(), message: t('Платёж аннулирован.') };
}
