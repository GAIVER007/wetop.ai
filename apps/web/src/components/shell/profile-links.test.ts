import { describe, expect, it } from 'vitest';
import { CLOSED_ACCESS } from '../../lib/navigation';
import { profileLinks } from './profile-links';

/**
 * Меню профиля по ролям (владелец 31.10.2026: «добавь важные разделы… Филиалы там и идёт раздел все бизнесы, а не
 * организации; что должно быть у владельца, у управляющего (админа, кассира) и у сотрудника»; эскиз «да»).
 */
const as = (role: 'OWNER' | 'MANAGER' | 'STAFF' | 'EMPLOYEE') => ({ ...CLOSED_ACCESS, role });
const links = (role: Parameters<typeof as>[0], v: 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE' = 'BEAUTY') =>
  profileLinks(as(role), v).map((l) => [l.label, l.href]);

describe('меню профиля по ролям', () => {
  it('владелец: профиль, все бизнесы и филиалы, сотрудники, все настройки, история действий', () => {
    expect(links('OWNER')).toEqual([
      ['Профиль', '/profile'],
      ['Все бизнесы и филиалы', '/owner'],
      ['Сотрудники и доступ', '/team'],
      ['Все настройки', '/settings'],
      ['История действий', '/journal'],
    ]);
  });
  it('управляющий, админ, кассир: моя работа, касса, график своего направления, мой филиал', () => {
    expect(links('MANAGER', 'HOSPITALITY')).toEqual([
      ['Профиль', '/profile'],
      ['Моя работа', '/my-work'],
      ['Смена и касса', '/cashbox'],
      ['График работы', '/staff-schedule'],
      ['Мой филиал', '/branches'],
    ]);
    expect(links('STAFF', 'BEAUTY').map(([, h]) => h)).toEqual(['/profile', '/my-work', '/cashbox', '/beauty/schedule']);
    expect(links('STAFF', 'FOOD_SERVICE').map(([, h]) => h)).toContain('/employees/shifts');
  });
  it('сотрудник: только своё, ни касс, ни филиалов', () => {
    expect(links('EMPLOYEE')).toEqual([
      ['Профиль', '/profile'],
      ['Моя работа: записи, график, зарплата', '/my-work'],
    ]);
  });
  it('«Организаций» нет ни у кого', () => {
    for (const r of ['OWNER', 'MANAGER', 'STAFF', 'EMPLOYEE'] as const)
      expect(links(r).map(([l]) => l)).not.toContain('Организации');
  });
});
