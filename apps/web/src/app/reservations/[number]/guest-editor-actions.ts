'use server';
import { unstable_rethrow } from 'next/navigation';
import { ApiError, guestsApi } from '../../../lib/api';
import { deskShell } from '../../../lib/desk-shell';
import { bookingGuestEditable } from './guest-editor-access';
import { msg } from '../../../i18n';
export async function loadBookingGuest(id: string) {
  if (!bookingGuestEditable(await deskShell())) return { guest: null, error: msg('Изменение гостя недоступно.') };
  try {
    return { guest: await guestsApi.card(id), error: null };
  } catch (error) {
    unstable_rethrow(error);
    return { guest: null, error: error instanceof ApiError && error.status === 403
      ? msg('Недостаточно прав для данных гостя.') : msg('Не удалось загрузить гостя. Попробуйте снова.') };
  }
}
