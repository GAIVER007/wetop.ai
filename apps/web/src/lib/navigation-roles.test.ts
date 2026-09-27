import { describe, expect, it } from 'vitest';
import {
  CLOSED_ACCESS,
  PENDING_ACCESS,
  deskAccessOf,
  mayAccess,
  navigationItems,
  routeRule,
  sidebarSectionsFor,
  type NavigationAccess,
} from './navigation';

/**
 * Меню и страницы по ролям (ADR-100, DATA_MODEL §16.5): администратор видит работу с гостями, «Оплаты» и «Статистику»
 * на просмотр, диалоги продавца и неисправности; управляющий — всё, кроме «Платформы»; никто не вошёл (замок выключен
 * в разработке) — всё, кроме «Платформы», как раньше.
 */
const access = (role: NavigationAccess['role'], platform = false): NavigationAccess => ({
  aiSeller: true,
  platform,
  role,
});
const hrefs = (a: NavigationAccess) =>
  sidebarSectionsFor(a).flatMap((s) => s.items.map((i) => i.href));
const everything = sidebarSectionsFor(access(null, true)).flatMap((s) =>
  s.items.map((i) => i.href),
);

describe('меню по ролям', () => {
  it('у каждого пункта меню записано право — пункта «для всех по умолчанию» нет', () => {
    expect(navigationItems.filter((i) => !i.requires).map((i) => i.href)).toEqual([]);
  });

  it('администратор: работа с гостями, продавец (диалоги), оплаты и статистика, неисправности', () => {
    expect(hrefs(access('STAFF'))).toEqual([
      '/today',
      '/chessboard',
      '/reservations',
      '/guests',
      '/ai-seller',
      '/finance',
      '/management/statistics',
      '/incidents',
    ]);
    expect(sidebarSectionsFor(access('STAFF')).map((s) => s.id)).toEqual([
      'guests',
      'sales',
      'finance',
      'control',
    ]);
  });

  it('управляющий и владелец — всё, кроме «Платформы»; «Платформа» — по отметке главного администратора', () => {
    const noPlatform = everything.filter((h) => !h.startsWith('/platform'));
    expect(hrefs(access('MANAGER'))).toEqual(noPlatform);
    expect(hrefs(access('OWNER'))).toEqual(noPlatform);
    expect(hrefs(access('STAFF', true))).toContain('/platform');
  });

  it('никто не вошёл — разделы по ролям не прячутся, «Платформа» — прячется', () => {
    expect(hrefs(CLOSED_ACCESS)).toEqual(everything.filter((h) => !h.startsWith('/platform')));
  });

  it('пока «кто вошёл» не известен, меню — как у администратора: не обещать лишнего', () => {
    expect(hrefs(PENDING_ACCESS)).toEqual(hrefs(access('STAFF')));
  });
});

describe('страница по адресу: какое право её открывает', () => {
  it('разделы меню и их вложенные адреса', () => {
    expect(routeRule('/rates')?.requires).toBe('rates');
    expect(routeRule('/channels/events/rev-1')?.requires).toBe('channels');
    expect(routeRule('/hotel-settings/penalties')?.requires).toBe('settings');
    expect(routeRule('/journal')?.requires).toBe('journal');
    expect(routeRule('/finance')?.requires).toBe('reports');
    expect(routeRule('/ai-seller/dialogs')?.requires).toBe('dialogs');
  });

  it('адреса вне меню: настройки продавца и его агенты', () => {
    expect(routeRule('/ai-seller/knowledge')?.requires).toBe('seller');
    expect(routeRule('/ai-seller/connections')?.requires).toBe('seller');
    expect(routeRule('/ai-seller/agents/new')?.requires).toBe('seller');
  });

  it('первичная настройка не закрыта: туда гейт ведёт и администратора, страница говорит, кто настраивает', () => {
    expect(routeRule('/onboarding')).toBeUndefined();
  });

  it('карточка ячейки и брони — работа смены, отдельного права нет', () => {
    expect(routeRule('/units/R01')).toBeUndefined();
    expect(routeRule('/reservations/20260927-ABC123')?.requires).toBe('desk');
  });
});

describe('право вошедшего', () => {
  it('по роли; никто не вошёл — открыто, как в API без человека за запросом', () => {
    expect(mayAccess(access('STAFF'), 'refunds')).toBe(false);
    expect(mayAccess(access('MANAGER'), 'refunds')).toBe(true);
    expect(mayAccess(access('MANAGER'), 'owner')).toBe(false);
    expect(mayAccess(CLOSED_ACCESS, 'owner')).toBe(true);
  });

  it('роль из `/auth/me`: незнакомая — администратор; никто не вошёл — роли нет', () => {
    expect(deskAccessOf({ user: { role: 'MANAGER' } }).role).toBe('MANAGER');
    expect(deskAccessOf({ user: { role: 'ADMIN' } }).role).toBe('STAFF');
    expect(deskAccessOf({ user: {} }).role).toBe('STAFF');
    expect(deskAccessOf({ user: null })).toBe(CLOSED_ACCESS);
    expect(deskAccessOf(null)).toBe(CLOSED_ACCESS);
  });
});
