import type { NavigationRequirement } from '../navigation';
import type { WebVertical } from '../vertical-landing';

/**
 * Реестр возможностей (CORE-03, срез C3a; план `plans/core-03-capability-registry-2026-10-21.md`,
 * целевая модель — `WETOP-CORE-ARCHITECTURE-01` §3). Одна запись на возможность вместо шести разрозненных
 * списков: отсюда в следующих срезах строятся меню (C3b), принадлежность адреса вертикали, допустимые адреса
 * после входа и смены филиала (C3c), гейт страницы и поиск (C3d).
 *
 * В этом срезе реестр ещё НИКТО не читает: `navigation.ts`, `features.ts` и остальные живут как жили,
 * а тест согласованности (`capabilities.test.ts`) держит реестр равным им байт в байт. Любое расхождение
 * с сегодняшним поведением — дефект среза, а не «улучшение».
 */

/**
 * Уровень, на котором живут данные возможности (ADR-183, ADR-188): организация, бизнес или филиал.
 * Он закрепляет принятые решения: гости гостиницы и ИИ-продавец — организация (O3=A, O2=A); каталоги
 * услуг, мастеров и меню — бизнес (F3: читают все филиалы, запись закрыта сотруднику с областью через
 * `@OrganizationLevel`); остальные рабочие экраны — выбранный филиал. У возможностей без данных арендатора
 * (помощь, «Что нового») уровень формально ORGANIZATION: филиал и бизнес на их содержимое не влияют.
 */
export type CapabilityScopeLevel = 'ORGANIZATION' | 'BUSINESS' | 'LOCATION';

export interface Capability {
  /** Стабильный ключ возможности; подстраницы модуля живут в одной записи списком `routes` */
  readonly id: string;
  /** Корневые адреса возможности; первый — главный экран, остальные — подстраницы и алиасы */
  readonly routes: readonly string[];
  /** Право, которым открыты пункт меню и страница (§16.5, ADR-107), или отметка `platform` */
  readonly requires: NavigationRequirement;
  /** Направления, которым возможность открыта, — как в реестре функций (`features.ts`, У1) */
  readonly verticals: readonly WebVertical[];
  readonly scopeLevel: CapabilityScopeLevel;
}

const H: readonly WebVertical[] = ['HOSPITALITY'];
const B: readonly WebVertical[] = ['BEAUTY'];
const F: readonly WebVertical[] = ['FOOD_SERVICE'];
const HB: readonly WebVertical[] = ['HOSPITALITY', 'BEAUTY'];
const BF: readonly WebVertical[] = ['BEAUTY', 'FOOD_SERVICE'];
const ALL: readonly WebVertical[] = ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'];

const cap = (
  id: string,
  routes: readonly string[],
  requires: Capability['requires'],
  verticals: readonly WebVertical[],
  scopeLevel: CapabilityScopeLevel,
): Capability => ({ id, routes, requires, verticals, scopeLevel });

export const CAPABILITIES: readonly Capability[] = [
  // ── рабочий день филиала ──────────────────────────────────────────────
  cap('today', ['/today'], 'desk', ALL, 'LOCATION'),
  cap('chessboard', ['/chessboard'], 'desk', H, 'LOCATION'),
  cap('reservations', ['/reservations'], 'desk', H, 'LOCATION'),
  // гости гостиницы общие для организации: у `Guest` нет ключа филиала (ADR-183, O3=A)
  cap('guests', ['/guests'], 'desk', H, 'ORGANIZATION'),
  cap('tasks', ['/tasks'], 'desk', H, 'LOCATION'),
  cap('beauty-journal', ['/beauty'], 'desk', B, 'LOCATION'),
  cap('calendar', ['/calendar'], 'desk', B, 'LOCATION'),
  cap('appointments', ['/appointments'], 'desk', B, 'LOCATION'),
  cap('beauty-schedule', ['/beauty/schedule'], 'desk', B, 'LOCATION'),
  cap('floor-plan', ['/floor-plan'], 'desk', F, 'LOCATION'),
  cap('table-reservations', ['/table-reservations'], 'desk', F, 'LOCATION'),
  cap('dining-areas', ['/dining-areas'], 'desk', F, 'LOCATION'),
  cap('orders', ['/orders'], 'desk', F, 'LOCATION'),
  // официант с телефона (§33.6, 22.10.2026): право «Приём заказов» (`orders`), есть и у «Личного кабинета»
  cap('waiter', ['/waiter'], 'orders', F, 'LOCATION'),
  cap('kitchen', ['/kitchen'], 'desk', F, 'LOCATION'),
  cap('drinks', ['/drinks'], 'desk', F, 'LOCATION'),
  cap('kitchen-stock', ['/stock'], 'desk', F, 'LOCATION'),
  // график персонала гостиницы (S10, миграция 143, решение владельца 22.10.2026)
  cap('staff-schedule', ['/staff-schedule'], 'desk', H, 'LOCATION'),
  cap('my-work', ['/my-work'], 'self', ALL, 'LOCATION'),

  // ── каталоги бизнеса: читают все филиалы, запись организационная (ADR-188, F3) ──
  cap('beauty-services', ['/beauty/services'], 'desk', B, 'BUSINESS'),
  cap('beauty-masters', ['/beauty/masters'], 'desk', B, 'BUSINESS'),
  cap('services', ['/services'], 'desk', B, 'BUSINESS'),
  cap('employees', ['/employees'], 'desk', BF, 'BUSINESS'),
  cap('employee-shifts', ['/employees/shifts'], 'desk', F, 'LOCATION'),
  cap('menu', ['/menu'], 'desk', F, 'BUSINESS'),
  // клиент — общий для бизнесов организации, связь с бизнесом появляется при первом обращении (ADR-188, F5=B)
  cap('customers', ['/customers'], 'desk', BF, 'BUSINESS'),

  // ── деньги филиала ────────────────────────────────────────────────────
  cap('finance', ['/finance'], 'reports', ALL, 'LOCATION'),
  cap('restaurant-finance', ['/restaurant-finance'], 'reports', F, 'LOCATION'),
  // гостиница (31.10.2026): пункт «Касса» ведёт на вкладку кассы её «Финансов»
  cap('cashbox', ['/cashbox'], 'desk', ALL, 'LOCATION'),
  cap('payroll', ['/payroll'], 'staff', ALL, 'ORGANIZATION'),
  // сертификат продаётся в филиале, действует на бизнес: у `GiftCertificate` ключ бизнеса (§ миграции №141)
  cap('certificates', ['/finance/certificates'], 'desk', B, 'BUSINESS'),
  cap('finance-report', ['/reports/finance'], 'reports', H, 'LOCATION'),
  cap('reports', ['/reports'], 'reports', ALL, 'LOCATION'),
  cap('analytics', ['/management/analytics'], 'reports', ALL, 'LOCATION'),
  // РНП бизнеса по дням (владелец 30.10.2026)
  cap('rnp', ['/rnp'], 'reports', ALL, 'LOCATION'),

  // ── склад ─────────────────────────────────────────────────────────────
  cap('warehouse', ['/warehouse'], 'reports', ALL, 'LOCATION'),
  cap('bar', ['/bar'], 'reports', ALL, 'LOCATION'),
  cap('bar-consumables', ['/bar/consumables'], 'reports', HB, 'LOCATION'),
  // «Меню бара» (DATA_MODEL §62.3): гостиница и салон
  cap('bar-menu', ['/bar/menu'], 'reports', HB, 'LOCATION'),
  cap('bar-products', ['/bar/products'], 'reports', ALL, 'LOCATION'),
  cap('bar-operations', ['/bar/operations'], 'reports', ALL, 'LOCATION'),
  cap('bar-receipts', ['/bar/receipts'], 'reports', ALL, 'LOCATION'),
  cap('bar-suppliers', ['/bar/suppliers'], 'reports', ALL, 'LOCATION'),

  // ── фонд гостиницы ────────────────────────────────────────────────────
  cap('rooms', ['/rooms', '/inventory', '/rooms/categories', '/rooms/availability'], 'property', H, 'LOCATION'),

  // ── продажи и продвижение ─────────────────────────────────────────────
  cap('sales', ['/sales'], 'reports', ALL, 'LOCATION'),
  cap(
    'channels',
    ['/channels', '/channels/connections', '/channels/mapping', '/channels/sync', '/channels/events'],
    'channels',
    H,
    'LOCATION',
  ),
  // ИИ-продавец — организационный (ADR-183, O2=A): диалоги и настройки не делятся по филиалам
  cap('ai-agents', ['/ai-agents', '/ai-seller'], 'dialogs', ALL, 'ORGANIZATION'),
  cap(
    'ai-seller-settings',
    ['/ai-seller/knowledge', '/ai-seller/connections', '/ai-seller/agents'],
    'seller',
    ALL,
    'ORGANIZATION',
  ),
  cap('marketing', ['/marketing'], 'marketing', ALL, 'LOCATION'),
  cap('marketing-budget', ['/marketing/budget'], 'marketing', ALL, 'LOCATION'),
  cap('marketing-analytics', ['/marketing/analytics'], 'marketing', ALL, 'LOCATION'),
  cap('marketing-ads', ['/marketing/ads'], 'marketing', ALL, 'LOCATION'),
  cap('marketing-content', ['/marketing/content'], 'marketing', ALL, 'LOCATION'),
  // голосовой агент (ИИ-колл-центр): все направления (решение владельца 22.10.2026)
  cap('marketing-voice', ['/marketing/voice'], 'marketing', ALL, 'LOCATION'),
  cap('market', ['/market'], 'reports', H, 'LOCATION'),
  cap('website', ['/website'], 'marketing', H, 'LOCATION'),

  // ── система ───────────────────────────────────────────────────────────
  cap('settings-hub', ['/settings'], 'desk', ALL, 'LOCATION'),
  cap(
    'hotel-settings',
    ['/hotel-settings', '/hotel-settings/stay', '/hotel-settings/services', '/hotel-settings/directories'],
    'settings',
    H,
    'LOCATION',
  ),
  cap('beauty-settings', ['/beauty-settings'], 'desk', B, 'LOCATION'),
  cap('restaurant-settings', ['/restaurant-settings'], 'property', F, 'LOCATION'),
  // способы оплаты филиала (§21.7): читает стойка, правят владелец и управляющий (`settings` на API)
  cap('branch-payment-methods', ['/branch-payment-methods'], 'desk', BF, 'LOCATION'),
  cap('team', ['/team'], 'staff', ALL, 'ORGANIZATION'),
  cap('staff-redirect', ['/staff'], 'staff', ALL, 'ORGANIZATION'),
  cap('connections', ['/connections'], 'settings', H, 'LOCATION'),
  cap('incidents', ['/incidents'], 'desk', H, 'LOCATION'),
  cap('journal', ['/journal'], 'journal', ALL, 'ORGANIZATION'),
  cap('platform', ['/platform'], 'platform', ALL, 'ORGANIZATION'),
  cap('platform-support', ['/platform/support'], 'platform', ALL, 'ORGANIZATION'),
  // «Все бизнесы» владельца (30.10.2026): свои бизнесы и филиалы во всех своих организациях
  cap('owner-businesses', ['/owner'], 'owner', ALL, 'ORGANIZATION'),
  // кабинет компании WETOP (28.10.2026): главная, деньги, подписки, команда
  cap('platform-cabinet', ['/platform/cabinet', '/platform/cabinet/money', '/platform/cabinet/subscriptions', '/platform/cabinet/team'], 'platform', ALL, 'ORGANIZATION'),

  // ── без данных арендатора: уровень формальный ─────────────────────────
  cap('help', ['/help'], 'desk', ALL, 'ORGANIZATION'),
  // «Обучение» (30.10.2026): инструкции у всех ролей, даже «Личный кабинет»
  cap('learn', ['/learn'], 'self', ALL, 'ORGANIZATION'),
  cap('profile', ['/profile'], 'desk', ALL, 'ORGANIZATION'),
  cap('whats-new', ['/whats-new'], 'desk', ALL, 'ORGANIZATION'),
];

/** Запись, отвечающая за адрес: самое длинное совпадение корня, как в `routeRule` и `features.ts` */
export function capabilityForRoute(path: string): Capability | undefined {
  let best: { capability: Capability; length: number } | undefined;
  for (const capability of CAPABILITIES)
    for (const route of capability.routes)
      if ((path === route || path.startsWith(`${route}/`)) && route.length > (best?.length ?? -1))
        best = { capability, length: route.length };
  return best?.capability;
}
