import { describe, expect, it } from 'vitest';
import { CLOSED_ACCESS, helpSteps, menuSectionsFor, routeRule } from './navigation';
import { settingsGroupsFor } from './settings-hub';
import { stockGroupsFor } from '../app/bar/tabs';

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
  it('меню «Настройки» одно у всех (31.10.2026): карточка объекта и ресторана внутри «Всех настроек»', () => {
    for (const v of ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'] as const) {
      expect(label(v, '/hotel-settings'), v).toBeUndefined();
      expect(label(v, '/restaurant-settings'), v).toBeUndefined();
      expect(label(v, '/settings'), v).toBe('Все настройки');
    }
  });

  it('ресторан: меню, брони столов и сотрудники вместо слов салона', () => {
    expect(label('FOOD_SERVICE', '/menu')).toBe('Меню');
    expect(label('FOOD_SERVICE', '/table-reservations')).toBe('Брони столов');
    expect(label('FOOD_SERVICE', '/employees')).toBe('Сотрудники');
    // учётные записи на том же экране «Сотрудники», второго пункта нет (25.10.2026)
    expect(label('FOOD_SERVICE', '/team')).toBeUndefined();
    expect(label('BEAUTY', '/services')).toBe('Каталог');
    expect(label('BEAUTY', '/appointments')).toBe('Записи');
    expect(label('BEAUTY', '/employees')).toBe('Сотрудники');
  });

  it('склад: «Бар» и «Кухня» у салона и гостиницы (решение владельца 24.10.2026)', () => {
    expect(label('BEAUTY', '/bar')).toBe('Бар');
    expect(label('BEAUTY', '/bar/consumables')).toBe('Кухня');
    expect(label('HOSPITALITY', '/bar')).toBe('Бар');
    expect(label('HOSPITALITY', '/bar/consumables')).toBe('Кухня');
    expect(label('FOOD_SERVICE', '/stock')).toBe('Склад кухни');
    expect(label('FOOD_SERVICE', '/bar')).toBe('Бар');
  });

  it('верхние вкладки склада ведут на пункты меню «Склад» (вариант C владельца 31.10.2026)', () => {
    for (const v of ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'] as const)
      for (const g of stockGroupsFor(v)) expect(label(v, g.tabs[0]!.href), `${v} ${g.label}`).toBeTruthy();
    // внутренние вкладки (меню бара, номенклатура, поставщики) открываются правом раздела
    for (const href of ['/bar/menu', '/bar/products', '/bar/suppliers']) expect(routeRule(href)?.requires, href).toBeTruthy();
  });

  it('шаги «Помощи» находят пункты под словами направления', () => {
    expect(helpSteps(menuSectionsFor(owner, 'FOOD_SERVICE'), 'FOOD_SERVICE').map((s) => s.path)).toEqual([
      'Услуги → Меню',
      'Персонал → Сотрудники',
      'Журнал',
      'Настройки → Все настройки',
    ]);
    expect(helpSteps(menuSectionsFor(owner, 'BEAUTY'), 'BEAUTY').map((s) => s.path)).toEqual([
      'Услуги → Каталог',
      'Персонал → Сотрудники',
      'Журнал',
      'Настройки → Все настройки',
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
