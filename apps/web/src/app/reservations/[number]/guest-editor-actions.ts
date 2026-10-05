'use server';
import { ApiError, guestsApi } from '../../../lib/api';
export async function loadBookingGuest(id: string) {
  try {
    return { guest: await guestsApi.card(id), error: null };
  } catch (error) {
    return {
      guest: null,
      error:
        error instanceof ApiError ? error.message : 'Не удалось загрузить гостя. Попробуйте снова.',
    };
  }
}
