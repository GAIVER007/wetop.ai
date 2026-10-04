'use server';
import { ApiError, sharedOnboardingApi } from '../../../lib/api';
export async function saveOnboarding(body: Parameters<typeof sharedOnboardingApi.save>[0]) {
  try {
    return { state: await sharedOnboardingApi.save(body), error: null };
  } catch (error) {
    return {
      state: null,
      error:
        error instanceof ApiError ? error.message : 'Не удалось сохранить. Попробуйте ещё раз.',
    };
  }
}
