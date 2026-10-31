import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CLOSED_ACCESS,
  activeSectionOf,
  beautyMenuSections,
  foodMenuSections,
  menuSections,
  menuSectionsFor,
  type MenuSection,
} from './navigation';
import type { WebVertical } from './vertical-landing';

/**
 * Реестр меню трёх направлений (план DS2 §14, §17): ссылка меню ведёт прямо на экран, а не на адрес-перенаправление,
 * и на настоящую страницу приложения; подсветка своя у каждого направления и не берётся у чужого.
 */
const APP = resolve(import.meta.dirname, '../app');
const owner = { ...CLOSED_ACCESS, role: 'OWNER' as const };
const REGISTRY: Record<WebVertical, MenuSection[]> = {
  HOSPITALITY: menuSections,
  BEAUTY: beautyMenuSections,
  FOOD_SERVICE: foodMenuSections,
};
/** Адреса, которые сами перенаправляют на другой экран: старые закладки живут, но меню на них не ведёт */
const REDIRECT_SOURCES = ['/staff', '/rates', '/rooms', '/channel-manager'];

const items = (vertical: WebVertical) =>
  REGISTRY[vertical].flatMap((section) => section.items.map((item) => ({ section, item })));

describe('реестр меню', () => {
  it('ни одна ссылка меню не ведёт на перенаправление: «Сотрудники и доступ» сразу на /team', () => {
    for (const vertical of Object.keys(REGISTRY) as WebVertical[])
      expect(
        items(vertical)
          .map(({ item }) => item.href)
          .filter((href) => REDIRECT_SOURCES.includes(href)),
        vertical,
      ).toEqual([]);
  });

  it('каждая ссылка меню ведёт на настоящую страницу приложения', () => {
    const exists = (href: string) => {
      const dir = resolve(APP, `.${href}`);
      if (existsSync(resolve(dir, 'page.tsx'))) return true;
      // необязательный сегмент `[[...section]]` отдаёт и корень раздела
      return existsSync(dir) && readdirSync(dir).some((name) => /^\[\[\.\.\..+\]\]$/.test(name));
    };
    for (const vertical of Object.keys(REGISTRY) as WebVertical[])
      for (const { item } of items(vertical)) expect(exists(item.href), `${vertical} ${item.href}`).toBe(true);
  });

  it('у каждого пункта есть право: закрытую страницу меню не обещает', () => {
    for (const vertical of Object.keys(REGISTRY) as WebVertical[])
      for (const { item } of items(vertical)) expect(item.requires, `${vertical} ${item.href}`).toBeTruthy();
  });

  it('внутри направления адреса пунктов не повторяются, внутри раздела подписи тоже', () => {
    const dupes = (values: string[]) => values.filter((v, i) => values.indexOf(v) !== i);
    for (const vertical of Object.keys(REGISTRY) as WebVertical[]) {
      expect(dupes(items(vertical).map(({ item }) => item.href)), vertical).toEqual([]);
      for (const section of REGISTRY[vertical])
        expect(dupes(section.items.map((item) => item.label)), `${vertical} ${section.id}`).toEqual([]);
    }
  });
});

describe('подсветка раздела у салона и ресторана', () => {
  const at = (vertical: WebVertical, path: string) =>
    activeSectionOf(menuSectionsFor(owner, vertical), path)?.id;

  it('«Сотрудники» горят в «Персонале» и на /team, и на старой закладке /staff', () => {
    // верхнее меню 17.10.2026: учётные записи у всех направлений в разделе «Персонал»
    for (const vertical of ['BEAUTY', 'FOOD_SERVICE', 'HOSPITALITY'] as const)
      for (const path of ['/team', '/staff']) expect(at(vertical, path), `${vertical} ${path}`).toBe('staff');
  });

  it('внутренние вкладки склада (вариант C 31.10.2026) подсвечивают «Склад», а не «Разделы»', () => {
    for (const vertical of ['BEAUTY', 'FOOD_SERVICE', 'HOSPITALITY'] as const)
      for (const path of ['/bar/products', '/bar/menu', '/bar/suppliers', '/bar/receipts/new', '/bar/consumables'])
        expect(at(vertical, path), `${vertical} ${path}`).toBe('stock');
  });

  it('прежние адреса салона подсвечивают свой раздел', () => {
    expect(at('BEAUTY', '/beauty')).toBe('journal');
    expect(at('BEAUTY', '/beauty/masters')).toBe('staff');
    expect(at('BEAUTY', '/beauty/services')).toBe('services');
    expect(at('BEAUTY', '/beauty/schedule')).toBe('staff');
  });
});
