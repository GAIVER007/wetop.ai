'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, marketApi } from '../../lib/api';
import { pluralRu } from '../../lib/plural';

/** Результат действия раздела «Загрузка конкурентов»: ошибка словами у формы, введённое не теряется */
export interface MarketActionResult {
  error: string | null;
  /** метка успеха: клиент закрывает панель и показывает «✓» */
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
const done = (message: string): MarketActionResult => {
  revalidatePath('/market');
  return { error: null, ok: Date.now(), message };
};
/** Поля формы конкурента; пустое необязательное поле уходит пустой строкой и снимается (null) на API */
const competitorBody = (fd: FormData) => ({
  name: s(fd, 'name'),
  distanceM: s(fd, 'distanceM'),
  unitsTotal: s(fd, 'unitsTotal'),
  url: s(fd, 'url'),
  note: s(fd, 'note'),
  district: s(fd, 'district'),
  category: s(fd, 'category'),
  address: s(fd, 'address'),
  dataSource: s(fd, 'dataSource'),
  monitoring: s(fd, 'monitoring') || undefined,
  refreshHours: s(fd, 'refreshHours'),
  autoRefresh: fd.get('autoRefresh') === 'on',
});

export async function saveCompetitorAction(
  _prev: MarketActionResult,
  fd: FormData,
): Promise<MarketActionResult> {
  const id = s(fd, 'id');
  try {
    if (id) await marketApi.updateCompetitor(id, competitorBody(fd));
    else await marketApi.createCompetitor(competitorBody(fd));
  } catch (e) {
    return { error: describe(e), ok: 0, values: echo(fd) };
  }
  return done(id ? 'Конкурент сохранён' : 'Конкурент добавлен');
}

export async function archiveCompetitorAction(
  _prev: MarketActionResult,
  fd: FormData,
): Promise<MarketActionResult> {
  try {
    await marketApi.updateCompetitor(s(fd, 'id'), { active: false });
  } catch (e) {
    return { error: describe(e), ok: 0 };
  }
  return done('Конкурент убран из списка, история сохранена');
}

/**
 * Загрузка по ночам: поля `p:<дата>`. Заполненные уходят все: сохранить без правок значит «сегодня проверил, то же
 * самое», и снимок дня ложится заново. Очищенное поле (было значение, стало пусто) снимает сегодняшнее значение.
 */
export async function writeOccupancyAction(
  _prev: MarketActionResult,
  fd: FormData,
): Promise<MarketActionResult> {
  const entries: Array<{ date: string; percent: string | null }> = [];
  for (const [key, value] of fd.entries()) {
    if (!key.startsWith('p:') || typeof value !== 'string') continue;
    const date = key.slice(2);
    const now = value.trim();
    if (now !== '') entries.push({ date, percent: now });
    else if (s(fd, `was:${date}`) !== '') entries.push({ date, percent: null });
  }
  if (entries.length === 0) return { error: 'Заполните загрузку хотя бы на одну ночь', ok: 0, values: echo(fd) };
  try {
    await marketApi.writeOccupancy(s(fd, 'id'), entries);
  } catch (e) {
    return { error: describe(e), ok: 0, values: echo(fd) };
  }
  return done(`Загрузка сохранена: ${pluralRu(entries.length, ['ночь', 'ночи', 'ночей'])}`);
}

/** Цены по ночам: поля `r:<дата>`, правила те же, что у загрузки (заполненное уходит, очищенное снимает) */
export async function writeRatesAction(
  _prev: MarketActionResult,
  fd: FormData,
): Promise<MarketActionResult> {
  const entries: Array<{ date: string; price: string | null }> = [];
  for (const [key, value] of fd.entries()) {
    if (!key.startsWith('r:') || typeof value !== 'string') continue;
    const date = key.slice(2);
    const now = value.trim();
    if (now !== '') entries.push({ date, price: now });
    else if (s(fd, `was:${date}`) !== '') entries.push({ date, price: null });
  }
  if (entries.length === 0) return { error: 'Заполните цену хотя бы на одну ночь', ok: 0, values: echo(fd) };
  try {
    await marketApi.writeRates(s(fd, 'id'), entries);
  } catch (e) {
    return { error: describe(e), ok: 0, values: echo(fd) };
  }
  return done(`Цены сохранены: ${pluralRu(entries.length, ['ночь', 'ночи', 'ночей'])}`);
}
