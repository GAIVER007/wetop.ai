'use server';
import { redirect } from 'next/navigation';
import { ApiError, onboardingApi, type OnboardingCategoryInput } from '../../lib/api';

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
