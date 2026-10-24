/**
 * Проверка формы брони ресторана своими русскими словами (аудит ресторана 22.10.2026): браузерная проверка
 * писала по-английски «Please select an item in the list.», а гостю без брони имя не нужно.
 */
export const WALK_IN_GUEST = 'Гость';

/** Имя гостя без брони: пустое поле становится «Гость» */
export function walkInFirstName(value: string): string {
  return value.trim() || WALK_IN_GUEST;
}

export function reservationProblem(f: {
  walkIn: boolean;
  mode: 'existing' | 'new';
  customerId: string;
  firstName: string;
  tableId: string;
  period: string;
}): string | null {
  if (f.mode === 'existing' && !f.customerId) return 'Выберите клиента';
  if (f.mode === 'new' && !f.walkIn && !f.firstName.trim()) return 'Укажите имя гостя';
  if (!f.period) return 'Выберите период обслуживания';
  if (f.walkIn && !f.tableId) return 'Выберите стол';
  return null;
}
