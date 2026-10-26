'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, branchesApi } from '../lib/api';
import { msg } from '../i18n';

/** Сохранить язык организации (ORG-LOCALE-20261026). Право проверяет API: только владелец */
export async function saveOrganizationLocale(
  locale: string,
): Promise<{ error: string | null; locale: string | null }> {
  try {
    const saved = await branchesApi.setLocale(locale);
    revalidatePath('/branches');
    revalidatePath('/register/setup');
    return { error: null, locale: saved.locale };
  } catch (error) {
    return {
      error: error instanceof ApiError ? error.message : msg('Не удалось сохранить. Попробуйте ещё раз.'),
      locale: null,
    };
  }
}
