import { describe, expect, it } from 'vitest';
import type { NavigationAccess } from './navigation';
import {
  CLOSED_ACCESS,
  pageOpen,
  beautyTotalsVisible,
  beautyMenuSections,
  menuSectionsFor,
  phoneNavigationFor,
} from './navigation';

const owner = { ...CLOSED_ACCESS, role: 'OWNER' as const };
const hrefs = (vertical?: 'HOSPITALITY' | 'BEAUTY') =>
  menuSectionsFor(owner, vertical).flatMap((s) => s.items.map((i) => i.href));
const sectionsOf = (vertical: 'BEAUTY') =>
  menuSectionsFor(owner, vertical).map((s) => [s.label, s.items.map((i) => i.href)]);

/**
 * Меню по вертикали филиала (решение Q-254 от 03.10.2026, ADR-141, срез B2). У салона нет ни объекта, ни
 * броней, ни тарифов: гостиничные разделы ему не показываются, они не нашли бы объект.
 */
describe('меню салона', () => {
  it('у филиала салона нет гостиничных разделов', () => {
    const items = hrefs('BEAUTY');
    for (const href of [
      '/chessboard',
      '/reservations',
      '/inventory',
      '/rates',
      '/channels',
      '/hotel-settings',
      '/website',
    ]) {
      expect(items, href).not.toContain(href);
    }
  });

  it('у филиала салона есть только то, что в нём работает', () => {
    // MV5 exposes only accepted operational screens.
    // верхнее меню по решению владельца 17.10.2026: строка разделов как в черновике `plans/top-nav-draft-2026-10-17.html`
    expect(sectionsOf('BEAUTY')).toEqual([
      ['Главная', ['/today']],
      ['Журнал', ['/calendar']],
      ['Персонал', ['/employees', '/team', '/beauty/schedule', '/payroll']],
      ['Клиенты', ['/customers', '/appointments']],
      ['Услуги', ['/services']],
      // Отдельные отчёты салона больше не перенаправляют в аналитику.
      ['Статистика', ['/management/analytics', '/reports']],
      ['Склад', ['/warehouse', '/bar', '/bar/consumables', '/bar/menu', '/bar/receipts', '/bar/products', '/bar/suppliers', '/bar/operations']],
      // касса филиала, общая с рестораном (§48, ADR-178 этап 0)
      // «Сертификаты» салона (решение 21.10.2026 §3)
      // «Сертификаты» салона пока скрыты в меню (запуск первого клиента 25.10.2026)
      ['Финансы', ['/finance', '/cashbox']],
      // «Подключения» и «Неисправности» только у гостиницы (аудит 17.10.2026, Д1)
      ['Настройки', ['/beauty-settings', '/journal', '/settings']],
      // «Продвижение» салона пока скрыто: не готово к первым клиентам (владелец 25.10.2026)
      ['Помощь', ['/help']],
    ]);
  });

  it('вертикаль не передана: меню гостиницы, как было до среза', () => {
    expect(hrefs()).toEqual(hrefs('HOSPITALITY'));
    expect(hrefs()).toContain('/chessboard');
    expect(hrefs()).not.toContain('/calendar');
  });

  it('нижняя панель телефона тоже идёт по вертикали', () => {
    // четыре вкладки это работа смены: Главная, Журнал, Клиенты, Услуги; остальное под «Ещё»
    expect(phoneNavigationFor('BEAUTY').map((i) => [i.href, i.label])).toEqual([
      ['/today', 'Главная'],
      ['/calendar', 'Журнал'],
      ['/customers', 'Клиенты'],
      ['/services', 'Услуги'],
    ]);
    expect(phoneNavigationFor().map((i) => i.href)).toContain('/chessboard');
  });

  it('первый пункт салона «Главная» на общем адресе /today (MV8, верхнее меню 17.10.2026)', () => {
    const first = menuSectionsFor(owner, 'BEAUTY')[0]!.items[0]!;
    expect(first).toMatchObject({ href: '/today', label: 'Главная', requires: 'desk' });
  });

  /**
   * Мастер и учётная запись сотрудника это разные экраны: `/employees` ведёт каталог мастеров филиала
   * (право `desk`, работа смены), `/team` заводит учётные записи и роли (право `staff`). В общем реестре
   * маршрутов у `/employees` стояла подпись «Сотрудники», и рядом с «Сотрудники и доступ» в меню салона
   * она читалась как тот же раздел. Подпись исправлена в самом реестре, а не аргументом `direct` по
   * вертикали: `/employees` есть только у салона (у ресторана этого пункта нет вовсе), поэтому вторая
   * подпись на тот же адрес разошлась бы с экраном. Экран назван так же, путь `beauty/masters` и подпись
   * под заголовком про мастера сети не менялись.
   */
  it('«Специалисты» и «Сотрудники» в меню салона не путаются', () => {
    const labels = new Map(
      menuSectionsFor(owner, 'BEAUTY').flatMap((s) => s.items.map((i) => [i.href, i.label] as const)),
    );
    // подписи верхнего меню 17.10.2026: мастера филиала это «Специалисты», учётные записи это «Сотрудники»
    expect(labels.get('/employees')).toBe('Специалисты');
    expect(labels.get('/team')).toBe('Сотрудники');
  });

  it('у каждого пункта салона есть право: закрытую страницу меню не обещает', () => {
    for (const section of beautyMenuSections) {
      for (const item of section.items) expect(item.requires, item.href).toBeTruthy();
    }
  });

  it('администратору смены платформа не видна, а своё рабочее место видно', () => {
    const staff = { ...CLOSED_ACCESS, role: 'STAFF' as const };
    const items = menuSectionsFor(staff, 'BEAUTY').flatMap((s) => s.items.map((i) => i.href));
    expect(items).toContain('/calendar');
    // каталог смена видит (чтение открыто `desk`), а править его не может: решает API по Q-253
    expect(items).toContain('/services');
    expect(items).not.toContain('/platform');
    expect(items).not.toContain('/journal');
  });
});

describe('запуск первых салонов (владелец 25.10.2026): недоделанное скрыто, админ видит только свою работу', () => {
  const platform = { ...CLOSED_ACCESS, role: 'OWNER' as const, platform: true };
  const staff = { ...CLOSED_ACCESS, role: 'STAFF' as const };
  const manager = { ...CLOSED_ACCESS, role: 'MANAGER' as const };
  const of = (access: NavigationAccess) => menuSectionsFor(access, 'BEAUTY').flatMap((s) => s.items.map((i) => i.href));
  it('владелец салона не видит «Продвижение» и «Сертификаты»', () => {
    expect(of(owner).filter((h) => h.startsWith('/marketing') || h === '/ai-agents' || h === '/sales')).toEqual([]);
    expect(of(owner)).not.toContain('/finance/certificates');
  });
  it('главный администратор платформы видит их, чтобы доделывать', () => {
    expect(of(platform)).toContain('/marketing');
    expect(of(platform)).toContain('/finance/certificates');
  });
  it('администратор (касса) не видит выручку салона: ни «Статистики», ни «Обзора финансов»; касса остаётся', () => {
    const items = of(staff);
    expect(items).toContain('/cashbox');
    expect(items).toContain('/calendar');
    for (const href of ['/finance', '/management/analytics', '/reports', '/marketing']) expect(items, href).not.toContain(href);
  });
  it('управляющий видит статистику и финансы, как владелец', () => {
    expect(of(manager)).toContain('/finance');
    expect(of(manager)).toContain('/management/analytics');
  });
  it('у гостиницы и ресторана меню не меняется', () => {
    expect(menuSectionsFor(owner, 'HOSPITALITY').flatMap((s) => s.items.map((i) => i.href))).toContain('/marketing');
    expect(menuSectionsFor(staff, 'FOOD_SERVICE').flatMap((s) => s.items.map((i) => i.href))).toContain('/restaurant-finance');
  });
});

describe('салон по прямому адресу: администратор не открывает итоги и недоделанное', () => {
  const projection = { mode: 'LEGACY' } as unknown as NonNullable<Parameters<typeof pageOpen>[0]['beautyAccess']>;
  const staff = { ...CLOSED_ACCESS, role: 'STAFF' as const, beautyAccess: projection };
  it('касса открывается, обзор финансов, аналитика и продвижение нет', () => {
    expect(pageOpen(staff, 'desk', '/cashbox')).toBe(true);
    for (const path of ['/finance', '/management/analytics', '/reports/finance', '/marketing/ads'])
      expect(pageOpen(staff, 'reports', path), path).toBe(false);
  });
});

describe('сводка «Главной» салона с выручкой', () => {
  it('администратору без должности не показывается, владельцу и управляющему да', () => {
    expect(beautyTotalsVisible({ ...CLOSED_ACCESS, role: 'STAFF' })).toBe(false);
    expect(beautyTotalsVisible({ ...CLOSED_ACCESS, role: 'OWNER' })).toBe(true);
    expect(beautyTotalsVisible({ ...CLOSED_ACCESS, role: 'MANAGER' })).toBe(true);
  });
});
