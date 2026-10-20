import { describe, expect, it } from 'vitest';
import { CLOSED_ACCESS, helpSteps, menuSectionsFor } from './navigation';

/**
 * «Помощь» одна у всех направлений (решение владельца 19.10.2026): шаги берутся из меню направления, поэтому слова и
 * ссылки совпадают с меню, а нового текста для нового направления писать не нужно.
 */
const owner = { ...CLOSED_ACCESS, role: 'OWNER' as const };
const steps = (v: 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE') =>
  helpSteps(menuSectionsFor(owner, v)).map((s) => [s.path, s.href]);

describe('первые шаги «Помощи» из меню', () => {
  it('у каждого направления те же шаги в том же порядке, ссылки на свои экраны', () => {
    expect(steps('BEAUTY')).toEqual([
      ['Услуги → Каталог', '/services'],
      ['Персонал → Специалисты', '/employees'],
      ['Журнал', '/calendar'],
      ['Настройки → Объект', '/beauty-settings'],
    ]);
    expect(steps('FOOD_SERVICE')).toEqual([
      ['Услуги → Каталог', '/menu'],
      ['Персонал → Специалисты', '/employees'],
      ['Журнал', '/floor-plan'],
      ['Настройки → Объект', '/restaurant-settings'],
    ]);
    // у гостиницы нет экрана специалистов: шага нет
    expect(steps('HOSPITALITY')).toEqual([
      ['Услуги → Каталог', '/inventory'],
      ['Журнал', '/chessboard'],
      ['Настройки → Объект', '/hotel-settings'],
    ]);
  });

  it('шаг к закрытому экрану не показывается', () => {
    const staff = helpSteps(menuSectionsFor({ ...CLOSED_ACCESS, role: 'STAFF' }, 'HOSPITALITY'));
    expect(staff.map((s) => s.href)).not.toContain('/hotel-settings');
  });
});
