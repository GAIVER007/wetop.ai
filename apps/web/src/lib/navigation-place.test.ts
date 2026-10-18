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
    ['/bar/receipts/new', 'Склад'],
    ['/reservations/20260913-TESTAA', 'Клиенты'],
    ['/units/R01', 'Услуги'],
    ['/rooms/categories', 'Услуги'],
    ['/tasks', 'Журнал'],
    ['/market', 'Продвижение'],
    ['/ai-seller/dialogs', 'Продвижение'],
    ['/website/settings', 'Продвижение'],
    ['/management/analytics/units', 'Статистика'],
    ['/branches', 'Настройки'],
    ['/profile', 'Профиль'],
    ['/help', 'Помощь'],
  ])('гостиница %s → %s', (path, expected) => expect(label('HOSPITALITY', path)).toBe(expected));

  it.each([
    ['/beauty', 'Журнал'],
    ['/beauty/masters', 'Персонал'],
    ['/beauty/schedule', 'Персонал'],
    ['/beauty/services', 'Услуги'],
    // верхнее меню 17.10.2026: учётные записи в разделе «Персонал» у всех направлений
    ['/team', 'Персонал'],
    ['/team/roles', 'Персонал'],
  ])('салон %s → %s', (path, expected) => expect(label('BEAUTY', path)).toBe(expected));

  it.each([
    ['/table-reservations', 'Клиенты'],
    ['/dining-areas', 'Услуги'],
    ['/kitchen', 'Услуги'],
    ['/team', 'Персонал'],
  ])('ресторан %s → %s', (path, expected) => expect(label('FOOD_SERVICE', path)).toBe(expected));
});
