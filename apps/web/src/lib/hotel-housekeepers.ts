import { unstable_rethrow } from 'next/navigation';
import { hotelStaffApi } from './hotel-staff-api';

/**
 * Сотрудники гостиницы для «Кто убирает» в карточке номера (22.10.2026). Отказ или старый API без раздела не ломают
 * карточку: выбора просто нет (`undefined`).
 */
export async function loadHousekeepers(): Promise<Array<{ id: string; name: string; active: boolean }> | undefined> {
  try {
    return (await hotelStaffApi.employees()).items.map(({ id, name, active }) => ({ id, name, active }));
  } catch (error) {
    unstable_rethrow(error);
    return undefined;
  }
}
