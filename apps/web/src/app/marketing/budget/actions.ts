'use server';
import { revalidatePath } from 'next/cache';
import { MARKETING_PLATFORMS } from '@pms/domain';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { META_ACCOUNTS_COOKIE, META_PENDING_COOKIE } from '../ads/meta-cookies';
import { ApiError, marketingBudgetApi, marketingCampaignsApi, metaConnectionApi } from '../../../lib/api';
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
  revalidatePath('/marketing/budget/plan');
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
  campaignId: s(fd, 'campaignId'),
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

/** Чек к расходу (§51): файл из формы уходит в API, ответ пересобирает страницу, панель остаётся открытой */
export async function uploadExpenseFileAction(
  _prev: BudgetActionResult,
  fd: FormData,
): Promise<BudgetActionResult> {
  const file = fd.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Выберите фото чека или PDF', ok: 0 };
  try {
    await marketingBudgetApi.uploadFile(s(fd, 'expenseId'), file);
  } catch (e) {
    return { error: describe(e), ok: 0 };
  }
  return done('Файл приложен к расходу');
}

export async function removeExpenseFileAction(
  _prev: BudgetActionResult,
  fd: FormData,
): Promise<BudgetActionResult> {
  try {
    await marketingBudgetApi.removeFile(s(fd, 'expenseId'), s(fd, 'fileId'));
  } catch (e) {
    return { error: describe(e), ok: 0 };
  }
  return done('Файл удалён, запись осталась в журнале организации');
}

const campaignBody = (fd: FormData) => ({
  platform: s(fd, 'platform'),
  name: s(fd, 'name'),
  status: s(fd, 'status'),
  startsOn: s(fd, 'startsOn'),
  endsOn: s(fd, 'endsOn'),
});

/** Кампания (§53): создание или правка одной формой */
export async function saveCampaignAction(_prev: BudgetActionResult, fd: FormData): Promise<BudgetActionResult> {
  const id = s(fd, 'id');
  try {
    if (id) await marketingCampaignsApi.update(id, campaignBody(fd));
    else await marketingCampaignsApi.create(campaignBody(fd));
  } catch (e) {
    return { error: describe(e), ok: 0, values: echo(fd) };
  }
  revalidatePath('/marketing/ads');
  return done(id ? 'Кампания сохранена' : 'Кампания создана');
}

/** День статистики кампании: ввод заменяет строку дня */
export async function saveCampaignDayAction(_prev: BudgetActionResult, fd: FormData): Promise<BudgetActionResult> {
  try {
    await marketingCampaignsApi.setDay(s(fd, 'id'), {
      date: s(fd, 'date'),
      impressions: s(fd, 'impressions'),
      clicks: s(fd, 'clicks'),
      leads: s(fd, 'leads'),
    });
  } catch (e) {
    return { error: describe(e), ok: 0, values: echo(fd) };
  }
  revalidatePath('/marketing/ads');
  return done('Статистика дня сохранена');
}

export async function removeCampaignDayAction(_prev: BudgetActionResult, fd: FormData): Promise<BudgetActionResult> {
  try {
    await marketingCampaignsApi.removeDay(s(fd, 'id'), s(fd, 'date'));
  } catch (e) {
    return { error: describe(e), ok: 0 };
  }
  revalidatePath('/marketing/ads');
  return done('День удалён, запись осталась в журнале организации');
}

/** CSV статистики кампании «Дата;Показы;Клики;Лиды»: всё или ничего */
export async function importCampaignDaysAction(_prev: BudgetActionResult, fd: FormData): Promise<BudgetActionResult> {
  const file = fd.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Выберите CSV-файл', ok: 0 };
  if (file.size > IMPORT_MAX_BYTES) return { error: 'Файл больше 512 КБ', ok: 0 };
  let r: { imported: number };
  try {
    r = await marketingCampaignsApi.importDays(s(fd, 'id'), decodeCsv(await file.arrayBuffer()));
  } catch (e) {
    return { error: describe(e), ok: 0 };
  }
  revalidatePath('/marketing/ads');
  return done(`Загружено ${pluralRu(r.imported, ['день', 'дня', 'дней'])} статистики`);
}

/** «Подключить через Facebook» (§55): сразу окно входа, кабинет человек отмечает там; браузер уходит на facebook.com */
export async function startMetaAction(): Promise<BudgetActionResult> {
  let url: string;
  try {
    url = (await metaConnectionApi.start()).url;
  } catch (e) {
    return { error: describe(e), ok: 0 };
  }
  redirect(url);
}

/** Выбор кабинета из нескольких, отмеченных в окне Facebook */
export async function chooseMetaAction(_prev: BudgetActionResult, fd: FormData): Promise<BudgetActionResult> {
  const jar = await cookies();
  const pending = jar.get(META_PENDING_COOKIE)?.value ?? '';
  if (!pending) return { error: 'Выбор кабинета устарел: подключите заново', ok: 0 };
  try {
    await metaConnectionApi.choose(pending, s(fd, 'adAccountId'));
  } catch (e) {
    return { error: describe(e), ok: 0 };
  }
  jar.delete(META_PENDING_COOKIE);
  jar.delete(META_ACCOUNTS_COOKIE);
  revalidatePath('/marketing/ads');
  redirect('/marketing/ads?meta=connected');
}

export async function syncMetaAction(): Promise<BudgetActionResult> {
  let r: { ok: boolean; days: number; campaigns: number; error: string | null };
  try {
    r = await metaConnectionApi.sync();
  } catch (e) {
    return { error: describe(e), ok: 0 };
  }
  revalidatePath('/marketing/ads');
  if (!r.ok) return { error: r.error, ok: 0 };
  return done(`Кабинет обновлён: ${pluralRu(r.campaigns, ['кампания', 'кампании', 'кампаний'])}, ${pluralRu(r.days, ['день', 'дня', 'дней'])}`);
}

export async function disconnectMetaAction(): Promise<BudgetActionResult> {
  try {
    await metaConnectionApi.disconnect();
  } catch (e) {
    return { error: describe(e), ok: 0 };
  }
  revalidatePath('/marketing/ads');
  return done('Кабинет отключён: ключ стёрт, кампании и статистика остались');
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

/** «Распределить план»: поле на каждый канал, пустое значит «канала в плане нет» (§52) */
export async function saveLinesAction(
  _prev: BudgetActionResult,
  fd: FormData,
): Promise<BudgetActionResult> {
  const lines = MARKETING_PLATFORMS.map((platform) => ({ platform, amount: s(fd, `amount-${platform}`) }));
  try {
    await marketingBudgetApi.setLines({ month: s(fd, 'month'), lines });
  } catch (e) {
    return { error: describe(e), ok: 0, values: echo(fd) };
  }
  return done('План по каналам сохранён');
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
