'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, businessMarketApi, type BusinessAvailability } from '../../../lib/api';

/** Результат действия «Конкуренты» салона и ресторана: ошибка словами у формы, введённое не теряется */
export interface BusinessMarketResult {
  error: string | null;
  ok: number;
  message?: string;
  values?: Record<string, string>;
}

const describe = (e: unknown) => (e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
const s = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' ? v.trim() : '';
};
const echo = (fd: FormData): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === 'string' && !k.startsWith('$')) out[k] = v;
  return out;
};
const done = (message: string): BusinessMarketResult => {
  revalidatePath('/market/business');
  return { error: null, ok: Date.now(), message };
};

export async function saveBusinessCompetitorAction(_: BusinessMarketResult, fd: FormData): Promise<BusinessMarketResult> {
  const body = { name: s(fd, 'name'), address: s(fd, 'address'), distanceM: s(fd, 'distanceM'), url: s(fd, 'url'), note: s(fd, 'note') };
  const id = s(fd, 'id');
  try {
    if (id) await businessMarketApi.update(id, body);
    else await businessMarketApi.create(body);
    return done(id ? 'Конкурент сохранён' : 'Конкурент добавлен');
  } catch (e) {
    return { error: describe(e), ok: 0, values: echo(fd) };
  }
}

export async function archiveBusinessCompetitorAction(_: BusinessMarketResult, fd: FormData): Promise<BusinessMarketResult> {
  try {
    await businessMarketApi.update(s(fd, 'id'), { active: false });
    return done('Конкурент убран из списка');
  } catch (e) {
    return { error: describe(e), ok: 0 };
  }
}

export async function writeBusinessSnapshotAction(_: BusinessMarketResult, fd: FormData): Promise<BusinessMarketResult> {
  const level = s(fd, 'level') as BusinessAvailability | '';
  try {
    await businessMarketApi.snapshot(s(fd, 'id'), { day: s(fd, 'day'), level, freeSlots: s(fd, 'freeSlots') });
    return done('Загрузка соседа сохранена');
  } catch (e) {
    return { error: describe(e), ok: 0, values: echo(fd) };
  }
}
