import { describe, expect, it } from 'vitest';
import { CLOSED_ACCESS, currentPlace, menuSectionsFor } from './navigation';

/**
 * Кнопка раздела в шапке называет раздел страницы на любом адресе направления (мастер-проход UI 11.10.2026):
 * до правки вложенные и внеменюшные адреса показывали «Разделы».
 */
const label = (vertical: 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE', path: string) =>
  currentPlace(menuSectionsFor(CLOSED_ACCESS, vertical), path).label;

describe('currentPlace', () => {
  it.each([
    ['/finance', 'Финансы'],
    ['/bar/receipts/new', 'Финансы'],
    ['/reservations/20260913-TESTAA', 'Гости и бронирования'],
    ['/units/R01', 'Номерной фонд'],
    ['/rooms/categories', 'Номерной фонд'],
    ['/tasks', 'Календарь'],
    ['/market', 'Продажи'],
    ['/ai-seller/dialogs', 'Продажи'],
    ['/website/settings', 'Маркетинг'],
    ['/management/analytics/units', 'Отчёты'],
    ['/branches', 'Настройки'],
    ['/profile', 'Профиль'],
    ['/help', 'Помощь'],
  ])('гостиница %s → %s', (path, expected) => expect(label('HOSPITALITY', path)).toBe(expected));

  it.each([
    ['/beauty', 'Календарь'],
    ['/beauty/masters', 'Мастера'],
    ['/beauty/schedule', 'График'],
    ['/beauty/services', 'Услуги'],
    ['/team', 'Сотрудники и доступ'],
    ['/team/roles', 'Сотрудники и доступ'],
  ])('салон %s → %s', (path, expected) => expect(label('BEAUTY', path)).toBe(expected));

  it.each([
    ['/table-reservations', 'Зал'],
    ['/dining-areas', 'Зал'],
    ['/kitchen', 'Заказы'],
    ['/team', 'Команда'],
  ])('ресторан %s → %s', (path, expected) => expect(label('FOOD_SERVICE', path)).toBe(expected));
});
