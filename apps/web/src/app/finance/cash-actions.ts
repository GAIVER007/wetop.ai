'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, financeApi } from '../../lib/api';

/** Результат действия кассы (§21): ошибка словами у формы, введённое не теряется */
export interface CashActionResult {
  error: string | null;
  /** метка успеха — клиент закрывает панель и показывает «✓» */
  ok: number;
  message?: string;
}

const FIELD_LABELS: Record<string, string> = {
  amount: 'Сумма',
  method: 'Способ',
  from: 'Откуда',
  to: 'Куда',
  categoryId: 'Статья',
  note: 'Комментарий',
  name: 'Название статьи',
  kind: 'Тип',
};
const humanize = (message: string) => {
  const m = /^([A-Za-z.]+) — (.+)$/s.exec(message);
  const label = m && FIELD_LABELS[m[1]!.replace('commission.', '')];
  return label ? `Поле «${label}»: ${m![2]}` : message;
};
const describe = (e: unknown) =>
  e instanceof ApiError ? humanize(e.message) : e instanceof Error ? e.message : String(e);
const s = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};
const done = (message: string): CashActionResult => {
  revalidatePath('/finance');
  return { error: null, ok: Date.now(), message };
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
  try {
    await financeApi.createCashOperation({
      kind: s(fd, 'kind'),
      method: s(fd, 'method'),
      amount: s(fd, 'amount'),
      ...(s(fd, 'categoryId') ? { categoryId: s(fd, 'categoryId') } : {}),
      note: s(fd, 'note') ?? null,
      ...(commissionOf(fd) ? { commission: commissionOf(fd) } : {}),
    });
  } catch (e) {
    return { error: describe(e), ok: _prev.ok };
  }
  return done(s(fd, 'kind') === 'EXPENSE' ? 'Расход записан.' : 'Поступление записано.');
}

export async function cashTransferAction(
  _prev: CashActionResult,
  fd: FormData,
): Promise<CashActionResult> {
  try {
    await financeApi.createCashTransfer({
      from: s(fd, 'from'),
      to: s(fd, 'to'),
      amount: s(fd, 'amount'),
      note: s(fd, 'note') ?? null,
      ...(commissionOf(fd) ? { commission: commissionOf(fd) } : {}),
    });
  } catch (e) {
    return { error: describe(e), ok: _prev.ok };
  }
  return done('Перевод записан.');
}

/** Аннулирование операции кассы (право как у возврата): комиссия снимается вместе с основной */
export async function voidCashOperationAction(id: string): Promise<CashActionResult> {
  try {
    await financeApi.voidCashOperation(id);
  } catch (e) {
    return { error: describe(e), ok: 0 };
  }
  return done('Операция аннулирована.');
}

export async function createCashCategoryAction(
  _prev: CashActionResult,
  fd: FormData,
): Promise<CashActionResult> {
  try {
    await financeApi.createCashCategory({ kind: s(fd, 'kind'), name: s(fd, 'name') });
  } catch (e) {
    return { error: describe(e), ok: _prev.ok };
  }
  return done('Статья добавлена.');
}

/** Выключить или включить статью; статья не удаляется — операциям остаётся след */
export async function toggleCashCategoryAction(fd: FormData): Promise<void> {
  const id = String(fd.get('id') ?? '');
  const active = String(fd.get('active') ?? '') === 'true';
  try {
    await financeApi.updateCashCategory(id, { active });
  } catch {
    // статус покажет перечитанный список; молча ломать навигацию формой нельзя
  }
  revalidatePath('/finance');
}
