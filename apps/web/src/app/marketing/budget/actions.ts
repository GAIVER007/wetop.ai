'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, marketingBudgetApi } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { pluralRu } from '../../../lib/plural';

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
  revalidatePath('/marketing/analytics');
  revalidatePath('/marketing');
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

/** Предел файла импорта: 1000 строк журнала с запасом; API принимает тело до 1 МБ */
const IMPORT_MAX_BYTES = 512 * 1024;

/** Excel на Windows сохраняет CSV в windows-1251: не UTF-8, значит, кириллица в однобайтовой кодировке */
const decodeCsv = (bytes: ArrayBuffer): string => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1251').decode(bytes);
  }
};

export async function importExpensesAction(
  _prev: BudgetActionResult,
  fd: FormData,
): Promise<BudgetActionResult> {
  const file = fd.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Выберите CSV-файл', ok: 0 };
  if (file.size > IMPORT_MAX_BYTES) return { error: 'Файл больше 512 КБ: разделите его по месяцам', ok: 0 };
  let r: { imported: number; baseTotal: string };
  try {
    r = await marketingBudgetApi.importExpenses(decodeCsv(await file.arrayBuffer()));
  } catch (e) {
    return { error: describe(e), ok: 0 };
  }
  const n = pluralRu(r.imported, ['расход', 'расхода', 'расходов']);
  return done(`Загружено ${n} на ${formatMoney(r.baseTotal, s(fd, 'currency'))}`);
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
