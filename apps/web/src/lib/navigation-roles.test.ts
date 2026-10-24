import { describe, expect, it } from 'vitest';
import {
  CLOSED_ACCESS,
  allowedItem,
  activeNavigation,
  PENDING_ACCESS,
  UNKNOWN_ACCESS,
  deskAccessOf,
  mayAccess,
  navigationItems,
  pageOpen,
  routeRule,
  menuSectionsFor,
  type NavigationAccess,
} from './navigation';

/**
 * Меню и страницы по ролям (ADR-107, DATA_MODEL §16.5): администратор видит работу с гостями, «Финансы» и «Статистику»
 * на просмотр, диалоги продавца и неисправности; управляющий — всё, кроме «Платформы»; никто не вошёл (замок выключен
 * в разработке) — всё, кроме «Платформы», как раньше.
 */
const access = (role: NavigationAccess['role'], platform = false): NavigationAccess => ({
  aiSeller: true,
  platform,
  role,
});
const hrefs = (a: NavigationAccess) =>
  menuSectionsFor(a).flatMap((s) => s.items.map((i) => i.href));
const everything = menuSectionsFor(access(null, true)).flatMap((s) =>
  s.items.map((i) => i.href),
);

describe('меню по ролям', () => {
  it('у каждого пункта меню записано право — пункта «для всех по умолчанию» нет', () => {
    expect(navigationItems.filter((i) => !i.requires).map((i) => i.href)).toEqual([]);
  });

  it('администратор: работа с гостями, продавец (диалоги), финансы и статистика, неисправности', () => {
    // верхнее меню 17.10.2026: те же права, новая группировка разделов
    expect(menuSectionsFor(access('STAFF')).map((s) => [s.id, s.items.map((i) => i.href)])).toEqual([
      ['today', ['/today']],
      ['journal', ['/chessboard']],
      // «График работы» горничных и ресепшена смотрит смена (право `desk`), как у ресторана (22.10.2026)
      ['staff', ['/staff-schedule']],
      ['clients', ['/guests', '/reservations']],
      ['stats', ['/management/analytics', '/reports']],
      // склад на экранах бара: администратор смотрит, как все отчёты (право `reports`)
      ['stock', ['/warehouse', '/bar', '/bar/consumables', '/bar/menu', '/bar/receipts', '/bar/products', '/bar/suppliers', '/bar/operations']],
      ['money', ['/finance', '/reports/finance']],
      // право `desk`: хаб «Все настройки» (в нём только открытые ему ссылки) и неисправности; остальные настройки закрыты
      ['settings', ['/incidents', '/settings']],
      // «Продвижение» по праву marketing закрыто, а продавец (диалоги) и конкуренты (право `reports`) открыты
      ['marketing', ['/ai-agents', '/market', '/sales']],
      ['help', ['/help']],
    ]);
  });

  it('«Бар»: экраны раздела «Склад», своей вкладки нет (ADR-157, верхнее меню 17.10.2026)', () => {
    const stock = menuSectionsFor(access('STAFF')).find((s) => s.id === 'stock');
    expect(stock?.label).toBe('Склад');
    expect(stock?.direct).toBeUndefined();
    expect(stock?.items.map((i) => [i.href, i.label])).toEqual([
      // в порядке вкладок экрана склада (19.10.2026)
      ['/warehouse', 'Обзор склада'],
      ['/bar', 'Бар'],
      ['/bar/consumables', 'Кухня'],
      // «Меню бара» (§62.3): кофе и закуски гостиницы и салона
      ['/bar/menu', 'Меню бара'],
      ['/bar/receipts', 'Приходы'],
      ['/bar/products', 'Номенклатура'],
      ['/bar/suppliers', 'Поставщики'],
      ['/bar/operations', 'Движение товаров'],
    ]);
  });

  it('управляющий и владелец — всё, кроме «Платформы»; «Платформа» — по отметке главного администратора', () => {
    const noPlatform = everything.filter((h) => !h.startsWith('/platform'));
    expect(hrefs(access('MANAGER'))).toEqual(noPlatform.filter((href) => href !== '/journal'));
    expect(hrefs(access('OWNER'))).toEqual(noPlatform);
    expect(hrefs(access('STAFF', true))).toContain('/platform');
  });

  it('«Организации» главного администратора лежат в «Настройках», отдельной вкладки «Платформа» нет', () => {
    const sections = menuSectionsFor(access('OWNER', true));
    expect(sections.map((s) => s.id)).not.toContain('platform');
    const settings = sections.find((s) => s.id === 'settings');
    expect(settings?.items.map((i) => i.href)).toContain('/platform');
    expect(settings?.items.find((i) => i.href === '/platform')?.label).toBe('Организации');
    // без отметки пункта нет нигде, у любой роли
    for (const role of ['OWNER', 'MANAGER', 'STAFF'] as const)
      expect(hrefs(access(role))).not.toContain('/platform');
  });

  it('никто не вошёл — разделы по ролям не прячутся, «Платформа» — прячется', () => {
    expect(hrefs(CLOSED_ACCESS)).toEqual(everything.filter((h) => !h.startsWith('/platform')));
  });

  it('«Продвижение» по праву settings: владелец и управляющий видят группу, администратор нет (MKT2)', () => {
    for (const role of ['OWNER', 'MANAGER'] as const) {
      expect(menuSectionsFor(access(role)).map((s) => s.id)).toContain('marketing');
      expect(hrefs(access(role))).toContain('/marketing');
    }
    // у администратора в группе только продавец, конкуренты и обзор продаж (бывшие «Продажи», верхнее меню
    // 17.10.2026); хаба, рекламы и бюджета нет
    expect(
      menuSectionsFor(access('STAFF'))
        .find((s) => s.id === 'marketing')
        ?.items.map((i) => i.href),
    ).toEqual(['/ai-agents', '/market', '/sales']);
    // адрес без пункта меню не открывает страницу: право то же, что у пункта
    expect(pageOpen(access('STAFF'), routeRule('/marketing')!.requires as 'settings')).toBe(false);
    expect(pageOpen(access('STAFF'), routeRule('/website/booking')!.requires as 'settings')).toBe(
      false,
    );
  });

  it('пока «кто вошёл» не известен, меню — как у администратора: не обещать лишнего', () => {
    expect(hrefs(PENDING_ACCESS)).toEqual(hrefs(access('STAFF')));
  });
});

describe('страница по адресу: какое право её открывает', () => {
  it('разделы меню и их вложенные адреса', () => {
    // «Тарифы и цены» сняты 06.10.2026: адрес только переадресует в «Категории номеров», права у него нет
    expect(routeRule('/rates')).toBeUndefined();
    expect(routeRule('/channels/events/rev-1')?.requires).toBe('channels');
    expect(routeRule('/hotel-settings/penalties')?.requires).toBe('settings');
    expect(routeRule('/journal')?.requires).toBe('journal');
    // пункта меню у «Гостей» нет (вкладка «Броней», 09.10.2026), право страницы прежнее
    expect(routeRule('/guests')?.requires).toBe('desk');
    expect(routeRule('/finance')?.requires).toBe('reports');
    expect(routeRule('/bar')?.requires).toBe('reports');
    // подстраницы бара (ADR-157) наследуют право пункта по длинному совпадению пути
    expect(routeRule('/bar/receipts/new')?.requires).toBe('reports');
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

  it('роль не узнали (сбой `/auth/me`): меню и кнопки — как у администратора', () => {
    expect(mayAccess(UNKNOWN_ACCESS, 'refunds')).toBe(false);
    expect(mayAccess(UNKNOWN_ACCESS, 'settings')).toBe(false);
    expect(hrefs(UNKNOWN_ACCESS)).toEqual(hrefs(PENDING_ACCESS));
  });

  it('страница по адресу: нет права — закрыта; роль не узнали — открыта, решает API, а не «нет доступа»', () => {
    expect(pageOpen(access('MANAGER'), 'settings')).toBe(true);
    expect(pageOpen(access('STAFF'), 'settings')).toBe(false);
    expect(pageOpen(PENDING_ACCESS, 'settings')).toBe(false);
    // владелец при недоступном API видел бы «Нет доступа… ваша роль — администратор» — неправду
    expect(pageOpen(UNKNOWN_ACCESS, 'settings')).toBe(true);
    expect(pageOpen(CLOSED_ACCESS, 'owner')).toBe(true);
  });

  it('роль из `/auth/me`: незнакомая — администратор; никто не вошёл — роли нет', () => {
    expect(deskAccessOf({ user: { role: 'MANAGER' } }).role).toBe('MANAGER');
    expect(deskAccessOf({ user: { role: 'ADMIN' } }).role).toBe('STAFF');
    expect(deskAccessOf({ user: {} }).role).toBe('STAFF');
    expect(deskAccessOf({ user: null })).toBe(CLOSED_ACCESS);
    expect(deskAccessOf(null)).toBe(CLOSED_ACCESS);
  });
});

describe('«ИИ-агенты» (S0)', () => {
  it('пункт меню зовётся «ИИ-агенты» и ведёт на вход раздела', () => {
    const item = navigationItems.find((i) => i.href === '/ai-agents');
    // имя в реестре совпадает с пунктом меню и заголовком страницы (мастер-проход UI, этап 2)
    expect(item?.label).toBe('ИИ-продавцы');
    expect(navigationItems.some((i) => i.href === '/ai-seller')).toBe(false);
  });

  it('страницы продавца подсвечивают пункт «ИИ-агенты», право у них прежнее', () => {
    expect(activeNavigation('/ai-seller')?.href).toBe('/ai-agents');
    expect(activeNavigation('/ai-seller/dialogs')?.href).toBe('/ai-agents');
    expect(routeRule('/ai-seller')?.requires).toBe('dialogs');
    expect(routeRule('/ai-agents')?.requires).toBe('dialogs');
  });

  it('каталог не открывает продавца тем, у кого его не было: вкладки требуют расширение, карточка WETOP Support — только платформу', () => {
    for (const path of ['/ai-seller/knowledge', '/ai-seller/connections', '/ai-seller/agents']) {
      expect(routeRule(path)?.requires).toBe('seller');
    }
    expect(allowedItem({ requires: 'platform' }, deskAccessOf({ user: { role: 'OWNER' } }))).toBe(
      false,
    );
    expect(
      allowedItem(
        { requires: 'platform' },
        deskAccessOf({ user: { role: 'OWNER', platformAdmin: true } }),
      ),
    ).toBe(true);
  });
});

it('сотрудники доступны в настройках только владельцу и управляющему', () => {
  expect(routeRule('/team')?.requires).toBe('staff');
  expect(hrefs(access('OWNER'))).toContain('/team');
  expect(hrefs(access('MANAGER'))).toContain('/team');
  expect(hrefs(access('STAFF'))).not.toContain('/team');
});
