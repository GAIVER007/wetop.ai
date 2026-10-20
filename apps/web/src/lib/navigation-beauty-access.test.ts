import type { BeautyPermission, BeautyPositionAccess, Permission } from '@pms/domain';
import { describe, expect, it } from 'vitest';
import {
  deskAccessOf,
  mayBeautyAccess,
  menuSectionsFor,
  pageOpen,
  routeRule,
  type NavigationAccess,
} from './navigation';

const permission = (
  section: BeautyPermission['section'],
  action: BeautyPermission['action'] = 'view',
  scope: BeautyPermission['scope'] = 'BUSINESS',
): BeautyPermission => ({ section, action, scope });

const assigned = (
  permissions: BeautyPermission[],
  options: { role?: NavigationAccess['role']; assigned?: boolean; unknown?: true } = {},
): NavigationAccess => ({
  aiSeller: false,
  platform: false,
  role: options.role ?? 'STAFF',
  beautyAccess: {
    mode: 'ASSIGNED',
    assigned: options.assigned ?? true,
    permissions,
  },
  ...(options.unknown ? { unknown: true as const } : {}),
});

const hrefs = (access: NavigationAccess) =>
  menuSectionsFor(access, 'BEAUTY').flatMap((section) => section.items.map((item) => item.href));

const beautyPageOpen = (access: NavigationAccess, path: string) => {
  const legacy = routeRule(path)?.requires;
  if (!legacy || legacy === 'platform') throw new Error(`No legacy page rule for ${path}`);
  return pageOpen(access, legacy, path);
};

describe('Beauty position access in the web shell', () => {
  it('normalizes the top-level /auth/me Beauty projection without broad role conversion', () => {
    const beautyAccess: BeautyPositionAccess = {
      mode: 'ASSIGNED',
      assigned: true,
      permissions: [
        permission('journal', 'view', 'OWN'),
        permission('payroll', 'view', 'OWN'),
      ],
    };
    expect(deskAccessOf({ user: { role: 'MANAGER' }, beautyAccess }).beautyAccess).toEqual(beautyAccess);
    expect(deskAccessOf({ user: { role: 'MANAGER' } }).beautyAccess).toBeUndefined();
  });

  it('uses exact section/action grants even when the old role was manager', () => {
    const master = assigned([
      permission('journal', 'view', 'OWN'),
      permission('appointments', 'view', 'OWN'),
      permission('payroll', 'view', 'OWN'),
      permission('reviews', 'view', 'OWN'),
    ], { role: 'MANAGER' });

    expect(mayBeautyAccess(master, 'journal', 'view', { legacy: 'desk', own: true })).toBe(true);
    expect(mayBeautyAccess(master, 'finance', 'view', { legacy: 'reports' })).toBe(false);
    expect(mayBeautyAccess(master, 'finance', 'refund', { legacy: 'refunds' })).toBe(false);
    expect(mayBeautyAccess(master, 'customers', 'view', { legacy: 'desk' })).toBe(false);

    // OWN opens the filtered personal cabinet, never the business-wide lists.
    expect(beautyPageOpen(master, '/calendar')).toBe(false);
    expect(beautyPageOpen(master, '/appointments')).toBe(false);
    expect(beautyPageOpen(master, '/payroll')).toBe(false);
    expect(beautyPageOpen(master, '/my-work')).toBe(true);
    expect(beautyPageOpen(master, '/customers')).toBe(false);
    expect(beautyPageOpen(master, '/finance')).toBe(false);
    for (const href of ['/calendar', '/appointments', '/payroll', '/customers', '/cashbox', '/finance', '/services', '/employees', '/team'])
      expect(hrefs(master)).not.toContain(href);
  });

  it('lets a custom staff position refund only when finance.refund is explicit', () => {
    const cashier = assigned([
      permission('finance', 'view'),
      permission('finance', 'refund'),
    ]);
    expect(mayBeautyAccess(cashier, 'finance', 'refund', { legacy: 'refunds' })).toBe(true);
    expect(mayBeautyAccess(cashier, 'customers', 'view', { legacy: 'desk' })).toBe(false);
    expect(beautyPageOpen(cashier, '/finance')).toBe(true);
    expect(beautyPageOpen(cashier, '/customers')).toBe(false);
  });

  it('closes Beauty work routes after the last assignment was revoked, including unknown-state bypass', () => {
    for (const access of [
      assigned([permission('journal')], { assigned: false }),
      assigned([permission('journal')], { assigned: false, unknown: true }),
    ]) {
      expect(beautyPageOpen(access, '/calendar')).toBe(false);
      expect(beautyPageOpen(access, '/my-work')).toBe(false);
      expect(hrefs(access)).not.toContain('/calendar');
    }
  });

  it('keeps OWNER unrestricted and preserves legacy access when assignments are not active', () => {
    const owner = assigned([], { role: 'OWNER', assigned: false });
    expect(beautyPageOpen(owner, '/customers')).toBe(true);
    expect(beautyPageOpen(owner, '/finance')).toBe(true);
    expect(hrefs(owner)).toContain('/team');

    const legacyProjection: BeautyPositionAccess = { mode: 'LEGACY', assigned: false, permissions: [] };
    const oldManager: NavigationAccess = { aiSeller: false, platform: false, role: 'MANAGER' };
    const projectedManager: NavigationAccess = { ...oldManager, beautyAccess: legacyProjection };
    expect(hrefs(projectedManager)).toEqual(hrefs(oldManager));
    for (const legacy of ['desk', 'reports', 'refunds', 'staff'] as Permission[]) {
      expect(mayBeautyAccess(projectedManager, 'finance', 'view', { legacy })).toBe(
        mayBeautyAccess(oldManager, 'finance', 'view', { legacy }),
      );
    }
  });

  it('shows team and roles only to an old manager with BUSINESS employees.view', () => {
    const manager = assigned([permission('employees', 'view')], { role: 'MANAGER' });
    const staff = assigned([permission('employees', 'view')], { role: 'STAFF' });
    const own = assigned([permission('employees', 'view', 'OWN')], { role: 'MANAGER' });

    expect(beautyPageOpen(manager, '/team')).toBe(true);
    expect(beautyPageOpen(manager, '/team/roles')).toBe(true);
    expect(hrefs(manager)).toContain('/team');
    for (const access of [staff, own]) {
      expect(beautyPageOpen(access, '/team')).toBe(false);
      expect(beautyPageOpen(access, '/team/roles')).toBe(false);
      expect(hrefs(access)).not.toContain('/team');
    }
  });

  it('derives parent menu visibility from authorized children and closes unmapped Beauty paths', () => {
    const clients = assigned([permission('customers', 'view')]);
    const sections = menuSectionsFor(clients, 'BEAUTY');
    expect(sections.find((section) => section.id === 'clients')?.items.map((item) => item.href)).toEqual(['/customers']);
    expect(sections.find((section) => section.id === 'money')).toBeUndefined();
    expect(beautyPageOpen(clients, '/management/analytics')).toBe(false);
  });

  it('opens salon consumables only with stock.view', () => {
    const stock = assigned([permission('stock', 'view')]);
    const customers = assigned([permission('customers', 'view')]);

    expect(beautyPageOpen(stock, '/bar/consumables')).toBe(true);
    expect(hrefs(stock)).toContain('/bar/consumables');
    expect(beautyPageOpen(customers, '/bar/consumables')).toBe(false);
    expect(hrefs(customers)).not.toContain('/bar/consumables');
  });

  // «Личный кабинет» (роль EMPLOYEE, решение владельца 20.10.2026): в меню только «Моя работа», рабочие разделы закрыты
  it('EMPLOYEE sees only «Моя работа» in every vertical', () => {
    const employee: NavigationAccess = {
      aiSeller: false,
      platform: false,
      role: 'EMPLOYEE',
      beautyAccess: { mode: 'LEGACY', assigned: false, permissions: [] },
    };
    expect(beautyPageOpen(employee, '/my-work')).toBe(true);
    for (const path of ['/calendar', '/customers', '/finance', '/employees', '/team'])
      expect(beautyPageOpen(employee, path)).toBe(false);
    // «Моя работа» открывается из меню профиля в шапке; рабочих разделов в меню нет
    expect(hrefs(employee)).not.toContain('/customers');
    expect(hrefs(employee)).not.toContain('/calendar');
    const food = menuSectionsFor({ aiSeller: false, platform: false, role: 'EMPLOYEE' }, 'FOOD_SERVICE').flatMap(
      (section) => section.items.map((item) => item.href),
    );
    expect(food).not.toContain('/orders');
    expect(food).not.toContain('/kitchen');
  });
});
