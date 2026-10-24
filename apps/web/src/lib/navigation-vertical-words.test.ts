import { describe, expect, it } from 'vitest';
import { CLOSED_ACCESS, helpSteps, menuSectionsFor } from './navigation';
import { settingsGroupsFor } from './settings-hub';
import { barSectionsFor } from '../app/bar/tabs';

/**
 * Подписи меню словами направления (аудит живого сайта 22.10.2026, салон P1 и ресторан P2): разделы и порядок одни,
 * а слово пункта своё: у салона «Салон», у ресторана «Меню», «Брони столов», «Сотрудники», у склада салона «Товары».
 */
const owner = { ...CLOSED_ACCESS, role: 'OWNER' as const };
const label = (v: 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE', href: string) =>
  menuSectionsFor(owner, v)
    .flatMap((s) => s.items)
    .find((i) => i.href === href)?.label;

describe('меню словами направления', () => {
  it('настройки места: «Объект» только у гостиницы', () => {
    expect(label('HOSPITALITY', '/hotel-settings')).toBe('Объект');
    expect(label('BEAUTY', '/beauty-settings')).toBe('Салон');
    expect(label('FOOD_SERVICE', '/restaurant-settings')).toBe('Ресторан');
  });

  it('ресторан: меню, брони столов и сотрудники вместо слов салона', () => {
    expect(label('FOOD_SERVICE', '/menu')).toBe('Меню');
    expect(label('FOOD_SERVICE', '/table-reservations')).toBe('Брони столов');
    expect(label('FOOD_SERVICE', '/employees')).toBe('Сотрудники');
    // учётные записи ресторана не второй пункт «Сотрудники»
    expect(label('FOOD_SERVICE', '/team')).toBe('Доступ и роли');
    expect(label('BEAUTY', '/services')).toBe('Каталог');
    expect(label('BEAUTY', '/appointments')).toBe('Записи');
    expect(label('BEAUTY', '/employees')).toBe('Специалисты');
  });

  it('склад: «Бар» и «Кухня» у салона и гостиницы (решение владельца 24.10.2026)', () => {
    expect(label('BEAUTY', '/bar')).toBe('Бар');
    expect(label('BEAUTY', '/bar/consumables')).toBe('Кухня');
    expect(label('HOSPITALITY', '/bar')).toBe('Бар');
    expect(label('HOSPITALITY', '/bar/consumables')).toBe('Кухня');
    expect(label('FOOD_SERVICE', '/stock')).toBe('Склад кухни');
    expect(label('FOOD_SERVICE', '/bar')).toBe('Бар');
  });

  it('вкладки склада называются как пункты меню', () => {
    for (const v of ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'] as const)
      for (const tab of barSectionsFor(v)) expect(tab.label, `${v} ${tab.href}`).toBe(label(v, tab.href));
  });

  it('шаги «Помощи» находят пункты под словами направления', () => {
    expect(helpSteps(menuSectionsFor(owner, 'FOOD_SERVICE'), 'FOOD_SERVICE').map((s) => s.path)).toEqual([
      'Услуги → Меню',
      'Персонал → Сотрудники',
      'Журнал',
      'Настройки → Ресторан',
    ]);
    expect(helpSteps(menuSectionsFor(owner, 'BEAUTY'), 'BEAUTY').map((s) => s.path)).toEqual([
      'Услуги → Каталог',
      'Персонал → Специалисты',
      'Журнал',
      'Настройки → Салон',
    ]);
  });

  it('хаб настроек ресторана: «Меню», «Сотрудники», «Сайт и онлайн-бронь»', () => {
    const links = settingsGroupsFor(owner, 'FOOD_SERVICE').flatMap((g) => g.links);
    const at = (href: string) => links.find((l) => l.href === href)?.label;
    expect(at('/menu')).toBe('Меню');
    expect(at('/employees')).toBe('Сотрудники');
    expect(at('/marketing/site/editor')).toBe('Сайт и онлайн-бронь');
    const beauty = settingsGroupsFor(owner, 'BEAUTY').flatMap((g) => g.links);
    expect(beauty.find((l) => l.href === '/services')?.label).toBe('Каталог услуг');
    expect(beauty.find((l) => l.href === '/marketing/site/editor')?.label).toBe('Сайт и онлайн-запись');
  });
});
