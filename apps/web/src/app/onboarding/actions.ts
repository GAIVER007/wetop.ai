'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ApiError, onboardingApi, type OnboardingCategoryInput } from '../../lib/api';
import {
  ONBOARDING_LATER_COOKIE,
  ONBOARDING_LATER_MAX_AGE_SECONDS,
} from '../../lib/onboarding-later';
import { cookieSecure } from '../../lib/session-cookie';

export interface ProvisionState {
  error: string | null;
}

/** Запустить отель: создать номера, тариф и цены. При удаче — на рабочее место. */
export async function provisionHotel(
  categories: OnboardingCategoryInput[],
): Promise<ProvisionState> {
  try {
    await onboardingApi.provision({ currency: 'KZT', categories });
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : 'Нет связи с сервером. Попробуйте ещё раз.',
    };
  }
  // redirect бросает служебное исключение — снаружи try, чтобы не принять его за ошибку
  redirect('/today');
}

/**
 * «Заполнить позже» (ADR-100): отметка кукой этого браузера, гейт перестаёт уводить на онбординг.
 * Номера по-прежнему не заведены — «Первые шаги» на Главной ведут их настроить.
 */
export async function postponeOnboarding(): Promise<void> {
  (await cookies()).set(ONBOARDING_LATER_COOKIE, '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure(process.env),
    path: '/',
    maxAge: ONBOARDING_LATER_MAX_AGE_SECONDS,
  });
  redirect('/today');
}
