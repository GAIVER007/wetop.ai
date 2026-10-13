'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, marketingBudgetApi } from '../../../lib/api';

/** Результат действия раздела «Бюджет»: ошибка словами у формы, введённое не теряется (как в /market) */
export interface BudgetActionResult {
  error: string | null;
  /** метка успеха: клиент закрывает панель и показывает уведомление */
  ok: number;
  message?: string;
  /** Введённое при отказе: форма возвращает его в поля (React сбрасывает форму после действия) */
  values?: Record<string, string>;
}

const describe = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);
const s = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' ? v.trim() : '';
};
const echo = (fd: FormData): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === 'string' && !k.startsWith('$')) out[k] = v;
  return out;
};
const done = (message: string): BudgetActionResult => {
  revalidatePath('/marketing/budget');
  revalidatePath('/marketing/budget/expenses');
  revalidatePath('/marketing/budget/analytics');
  return { error: null, ok: Date.now(), message };
};

const expenseBody = (fd: FormData) => ({
  date: s(fd, 'date'),
  platform: s(fd, 'platform'),
  campaign: s(fd, 'campaign'),
  category: s(fd, 'category'),
  description: s(fd, 'description'),
  amount: s(fd, 'amount'),
  currency: s(fd, 'currency'),
  fxRate: s(fd, 'fxRate'),
  // Switch шлёт пару значений: скрытое false и, если включено, true; значением считается последнее
  countedInBudget: fd.getAll('countedInBudget').at(-1) === 'true',
});

export async function saveExpenseAction(
  _prev: BudgetActionResult,
  fd: FormData,
): Promise<BudgetActionResult> {
  const id = s(fd, 'id');
  try {
    if (id) await marketingBudgetApi.updateExpense(id, expenseBody(fd));
    else await marketingBudgetApi.createExpense(expenseBody(fd));
  } catch (e) {
    return { error: describe(e), ok: 0, values: echo(fd) };
  }
  return done(id ? 'Расход сохранён' : 'Расход добавлен');
}

export async function deleteExpenseAction(
  _prev: BudgetActionResult,
  fd: FormData,
): Promise<BudgetActionResult> {
  try {
    await marketingBudgetApi.deleteExpense(s(fd, 'id'));
  } catch (e) {
    return { error: describe(e), ok: 0 };
  }
  return done('Расход удалён, запись об удалении осталась в журнале');
}

export async function savePlanAction(
  _prev: BudgetActionResult,
  fd: FormData,
): Promise<BudgetActionResult> {
  try {
    await marketingBudgetApi.setPlan({ month: s(fd, 'month'), amount: s(fd, 'amount') });
  } catch (e) {
    return { error: describe(e), ok: 0, values: echo(fd) };
  }
  return done('План месяца сохранён');
}
