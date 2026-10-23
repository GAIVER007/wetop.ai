'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { ApiError, authApi } from '../lib/api';
import { lastBranchCookieOptions } from '../lib/scope-pointer';
import { LOCALE_COOKIE, deskLocale } from '../i18n';

/**
 * Сменить язык стойки (ADR-163, KK1): `users.locale` через API, затем кука на полгода для страниц без сессии.
 * Без сессии (открытый dev-стенд) API ответит 401: язык держит одна кука. Другой отказ API язык не меняет.
 */
export async function changeLocale(form: FormData): Promise<void> {
  const locale = deskLocale(form.get('locale'));
  try {
    await authApi.changeLocale(locale);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.status !== 401) return;
  }
  (await cookies()).set(LOCALE_COOKIE, locale, lastBranchCookieOptions(process.env));
  revalidatePath('/', 'layout');
}
