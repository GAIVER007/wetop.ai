import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CLOSED_ACCESS,
  PENDING_ACCESS,
  UNKNOWN_ACCESS,
  activeItem,
  menuRegistry,
  menuSectionsFor,
  phoneNavigationFor,
  type NavigationAccess,
} from './navigation';
import type { WebVertical } from './vertical-landing';

/**
 * DS2a (план mv8-5-ds2-shell-navigation §12): один реестр меню на три направления и одно правило активного пункта.
 * Строка вкладок, меню в окне и нижняя панель телефона берут подсветку только у `activeItem`.
 */
const everyone: NavigationAccess = { aiSeller: true, platform: true, role: 'OWNER' };
const VERTICALS: WebVertical[] = ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'];

/** `раздел>адрес пункта` или `null`, если на этом адресе в направлении не горит ничего */
const at = (path: string, vertical: WebVertical, access: NavigationAccess = everyone) => {
  const hit = activeItem(path, vertical, access);
  return hit ? `${hit.sectionId}>${hit.href}` : null;
};

const HOSPITALITY: Array<[string[], string | null]> = [
  [['/today', '/today?date=2026-10-10', '/tasks'], 'home>/today'],
  [['/chessboard'], 'chessboard>/chessboard'],
  [
    [
      '/reservations',
      '/reservations/new',
      '/reservations/ABC',
      '/reservations/ABC/print/invoice',
      '/reservations/',
      '/reservations?status=new#top',
    ],
    'guests>/guests',
  ],
  // «Гости и бронирования» одной вкладкой (поручение владельца 09.10.2026, после плана DS2): брони подсвечивают её
  [['/guests', '/guests/123', '/guests/123/preview', '/guests/birthdays'], 'guests>/guests'],
  [['/finance'], 'finance>/finance'],
  [['/bar'], 'finance>/bar'],
  [['/inventory', '/rooms', '/rooms/categories', '/rates', '/units/R01'], 'inventory>/inventory'],
  [['/market'], 'sales>/market'],
  [
    ['/channels', '/channels/events/rev-1', '/channels/sync', '/channel-manager', '/connections/channex'],
    'sales>/channels',
  ],
  [['/ai-agents', '/ai-agents/new', '/ai-seller', '/ai-seller/knowledge'], 'sales>/ai-agents'],
  [
    ['/marketing', '/marketing/site/editor', '/website', '/website/booking'],
    'marketing>/marketing',
  ],
  [['/reports', '/reports/form-910'], 'reports>/reports'],
  [
    ['/management/analytics', '/management/analytics/units', '/management'],
    'reports>/management/analytics',
  ],
  [
    ['/hotel-settings', '/hotel-settings/stay', '/hotel-settings/stay#services'],
    'settings>/hotel-settings',
  ],
  [['/team', '/staff'], 'settings>/team'],
  [['/connections'], 'settings>/connections'],
  [['/branches'], 'settings>/branches'],
  [['/journal'], 'settings>/journal'],
  [['/incidents'], 'settings>/incidents'],
  [['/platform'], 'settings>/platform'],
  [['/platform/support', '/platform/support/knowledge'], 'settings>/platform/support'],
  [['/profile', '/profile/access'], 'account>/profile'],
  [['/help'], 'account>/help'],
  // граница сегмента и экраны других направлений
  [
    ['/reservations-old', '/websites', '/calendar', '/beauty', '/beauty/schedule', '/employees', '/floor-plan'],
    null,
  ],
];

const BEAUTY: Array<[string[], string | null]> = [
  [['/today', '/today?date=2026-10-10'], 'today>/today'],
  [['/calendar', '/beauty', '/beauty/'], 'calendar>/calendar'],
  [['/appointments'], 'appointments>/appointments'],
  [['/customers'], 'customers>/customers'],
  [['/employees', '/beauty/masters'], 'employees>/employees'],
  [['/beauty/schedule'], 'schedule>/beauty/schedule'],
  [['/services', '/beauty/services'], 'services>/services'],
  [['/team', '/staff'], 'team>/team'],
  [['/branches'], 'settings>/branches'],
  [['/management/analytics'], 'analytics>/management/analytics'],
  [['/journal'], 'journal>/journal'],
  [['/help'], 'help>/help'],
  [['/profile', '/profile/access'], 'profile>/profile'],
  [
    ['/website', '/reservations', '/tasks', '/chessboard', '/floor-plan', '/units/R01', '/platform/support'],
    null,
  ],
];

const FOOD: Array<[string[], string | null]> = [
  [['/today'], 'today>/today'],
  [['/floor-plan'], 'floor-plan>/floor-plan'],
  [['/table-reservations'], 'table-reservations>/table-reservations'],
  [['/customers'], 'customers>/customers'],
  [['/dining-areas'], 'dining-areas>/dining-areas'],
  [['/team', '/staff'], 'staff>/team'],
  [['/branches'], 'settings>/branches'],
  [['/management/analytics'], 'analytics>/management/analytics'],
  [['/journal'], 'journal>/journal'],
  [['/help'], 'help>/help'],
  [['/profile', '/profile/access'], 'profile>/profile'],
  [['/website', '/calendar', '/reservations', '/beauty/schedule', '/tasks'], null],
];

describe('activeItem: матрица активного пункта (DS2 §12)', () => {
  for (const [vertical, rows] of [
    ['HOSPITALITY', HOSPITALITY],
    ['BEAUTY', BEAUTY],
    ['FOOD_SERVICE', FOOD],
  ] as const) {
    it(`${vertical}: каждый адрес подсвечивает свой пункт или ничего`, () => {
      const got = rows.flatMap(([paths]) => paths.map((p) => [p, at(p, vertical)]));
      const want = rows.flatMap(([paths, expected]) => paths.map((p) => [p, expected]));
      expect(got).toEqual(want);
    });
  }

  it('незнакомое или неизвестное направление не считается гостиницей', () => {
    for (const vertical of [undefined, null, 'RETAIL', ''] as unknown as WebVertical[])
      for (const path of ['/today', '/reservations', '/team'])
        expect(activeItem(path, vertical, everyone)).toBeNull();
  });

  it('возвращает пункт и его раздел', () => {
    expect(activeItem('/connections/channex', 'HOSPITALITY', everyone)).toMatchObject({
      sectionId: 'sales',
      itemId: 'channels',
      href: '/channels',
    });
    expect(activeItem('/reservations/ABC', 'HOSPITALITY', everyone)).toMatchObject({
      sectionId: 'guests',
      itemId: 'guests',
      href: '/guests',
    });
  });

  it('пункт, закрытый роли, не подсвечивается', () => {
    const staff = { ...CLOSED_ACCESS, role: 'STAFF' as const };
    expect(at('/team', 'HOSPITALITY', staff)).toBeNull();
    expect(at('/team', 'BEAUTY', staff)).toBeNull();
    expect(at('/hotel-settings', 'HOSPITALITY', staff)).toBeNull();
    expect(at('/reports', 'HOSPITALITY', staff)).toBe('reports>/reports');
    expect(at('/incidents', 'HOSPITALITY', staff)).toBe('settings>/incidents');
    expect(at('/branches', 'HOSPITALITY', staff)).toBe('settings>/branches');
    expect(at('/journal', 'FOOD_SERVICE', staff)).toBeNull();
    // «Организации» и «Техподдержка» видны только главному администратору
    const owner = { ...CLOSED_ACCESS, role: 'OWNER' as const };
    expect(at('/platform/support', 'HOSPITALITY', owner)).toBeNull();
    expect(at('/platform', 'HOSPITALITY', owner)).toBeNull();
    // никто не вошёл (замок выключен): разделы по ролям не прячутся, как и в меню
    expect(at('/team', 'HOSPITALITY', CLOSED_ACCESS)).toBe('settings>/team');
    // ожидание и сбой /auth/me: как администратор
    expect(at('/team', 'HOSPITALITY', PENDING_ACCESS)).toBeNull();
    expect(at('/today', 'HOSPITALITY', UNKNOWN_ACCESS)).toBe('home>/today');
  });
});

describe('реестр меню (DS2a)', () => {
  const APP = resolve(import.meta.dirname, '../app');
  /** Адреса, которые сами перенаправляют на другой экран или станут перенаправлением в DS2c (§14) */
  const REDIRECT_SOURCES = ['/staff', '/rates', '/rooms', '/channel-manager', '/beauty', '/beauty/masters', '/beauty/services'];

  const items = (vertical: WebVertical) =>
    menuRegistry(vertical).flatMap((section) => section.items.map((item) => ({ section, item })));

  it('у каждого пункта есть id, подпись, адрес, иконка и право', () => {
    for (const vertical of VERTICALS)
      for (const { item } of items(vertical)) {
        expect(item.id, item.href).toMatch(/^[a-z-]+$/);
        expect(item.label, item.href).toBeTruthy();
        expect(item.href, item.label).toMatch(/^\/[a-z]/);
        expect(item.icon, item.href).toBeTruthy();
        expect(item.requires, item.href).toBeTruthy();
      }
  });

  it('внутри направления id, адреса и подписи пунктов не повторяются, внутри группы тоже', () => {
    for (const vertical of VERTICALS) {
      const all = items(vertical);
      const dupes = (values: string[]) => values.filter((v, i) => values.indexOf(v) !== i);
      expect(dupes(all.map(({ section, item }) => `${section.id}:${item.id}`)), vertical).toEqual([]);
      expect(dupes(all.map(({ item }) => item.href)), vertical).toEqual([]);
      expect(dupes(all.map(({ item }) => item.label)), vertical).toEqual([]);
      expect(dupes(menuRegistry(vertical).map((s) => s.id)), vertical).toEqual([]);
    }
  });

  it('ни один адрес меню не ведёт на перенаправление: «Сотрудники и доступ» сразу на /team', () => {
    for (const vertical of VERTICALS)
      expect(
        items(vertical)
          .map(({ item }) => item.href)
          .filter((href) => REDIRECT_SOURCES.includes(href)),
        vertical,
      ).toEqual([]);
    for (const vertical of VERTICALS)
      expect(
        menuSectionsFor(everyone, vertical).flatMap((s) => s.items.map((i) => i.href)),
      ).not.toContain('/staff');
  });

  it('каждый адрес меню ведёт на настоящую страницу приложения', () => {
    const exists = (href: string) => {
      const dir = resolve(APP, `.${href}`);
      if (existsSync(resolve(dir, 'page.tsx'))) return true;
      // необязательный сегмент `[[...section]]` отдаёт и корень раздела
      return existsSync(dir) && readdirSync(dir).some((name) => /^\[\[\.\.\..+\]\]$/.test(name));
    };
    for (const vertical of VERTICALS)
      for (const { item } of items(vertical)) expect(exists(item.href), item.href).toBe(true);
  });

  it('каждый префикс подсветки это целый адрес, не корень', () => {
    for (const vertical of VERTICALS)
      for (const { item } of items(vertical))
        for (const prefix of item.match ?? []) expect(prefix, item.href).toMatch(/^\/[a-z][a-z0-9/-]*[a-z0-9]$/);
  });

  it('пункты, скрытые до DS2b, в меню не видны: состав меню прежний', () => {
    for (const vertical of VERTICALS) {
      const shown = menuSectionsFor(everyone, vertical).flatMap((s) => s.items.map((i) => i.href));
      for (const href of ['/branches', '/beauty/schedule', '/platform/support'])
        expect(shown, vertical).not.toContain(href);
    }
    expect(menuSectionsFor(everyone, 'HOSPITALITY').map((s) => s.id)).not.toContain('account');
    expect(phoneNavigationFor('BEAUTY').map((i) => i.href)).toEqual([
      '/today',
      '/calendar',
      '/appointments',
      '/customers',
    ]);
  });
});

describe('оболочка берёт подсветку только у activeItem', () => {
  const read = (file: string) =>
    readFileSync(resolve(import.meta.dirname, '../components', file), 'utf8');

  it('строка вкладок, меню в окне и нижняя панель', () => {
    for (const file of ['shell/top-menu.tsx', 'shell/sidebar.tsx', 'top-nav.tsx']) {
      const src = read(file);
      expect(src, file).toMatch(/\bactiveItem\(/);
      expect(src, file).not.toMatch(/\bactiveMenuRoute\b|\bactiveNavigation\b/);
    }
  });

  it('меню в окне не берёт гостиничные разделы для подсветки', () => {
    expect(read('shell/sidebar.tsx')).not.toMatch(/\bmenuSections\b/);
  });
});
