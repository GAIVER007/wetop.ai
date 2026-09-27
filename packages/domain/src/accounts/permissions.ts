import type { MembershipRole } from './roles';

/**
 * Права ролей в организации (DATA_MODEL §16.5, ADR-101). Роль — готовый набор прав (ответ владельца 27.09.2026 «Роль =
 * готовый набор»); прав у отдельного человека нет. Одна таблица на API (замок ролей, `@Access`) и стойку (меню,
 * кнопки, закрытые страницы). Защитой считается только проверка в API.
 */
export type Permission =
  | 'self'
  | 'desk'
  | 'dialogs'
  | 'reports'
  | 'refunds'
  | 'property'
  | 'rates'
  | 'channels'
  | 'settings'
  | 'journal'
  | 'seller'
  | 'staff'
  | 'owner';

/** Название права — для отказа и подсказки на закрытой странице; порядок — как в таблице §16.5 */
export const PERMISSIONS: Readonly<Record<Permission, { label: string }>> = {
  // своё: профиль, пароль, сеансы, подпись помощника
  self: { label: 'Своя учётная запись' },
  // главная, шахматка, брони, гости, заселение и выселение, оплаты и начисления в счёт, печать, ячейка, неисправности
  desk: { label: 'Работа с гостями' },
  dialogs: { label: 'Диалоги ИИ-продавца' },
  // статистика и «Оплаты» — на просмотр
  reports: { label: 'Статистика и оплаты' },
  // возврат оплаты, сторно начисления (снятие штрафа за отмену — это сторно), корректировка на уменьшение
  refunds: { label: 'Возврат оплаты и сторно' },
  property: { label: 'Номерной фонд' },
  rates: { label: 'Тарифы и цены' },
  channels: { label: 'Каналы продаж' },
  // настройки гостиницы, правила отмены, услуги, интеграции, сайт и его аналитика, первичная настройка
  settings: { label: 'Настройки гостиницы' },
  journal: { label: 'Журнал действий' },
  seller: { label: 'Настройки ИИ-продавца' },
  staff: { label: 'Сотрудники и приглашения' },
  owner: { label: 'Управляющие, роли и платные расширения' },
};

const ALL = Object.keys(PERMISSIONS) as Permission[];

/**
 * Ответы владельца 27.09.2026: владельцу — всё; управляющему — «всё, кроме владельческого»; администратору — работа с
 * гостями, диалоги продавца и «плюс просмотр отчётов».
 */
const ROLE_PERMISSIONS: Readonly<Record<MembershipRole, readonly Permission[]>> = {
  OWNER: ALL,
  MANAGER: ALL.filter((p) => p !== 'owner'),
  STAFF: ['self', 'desk', 'dialogs', 'reports'],
};

const ROLE_ORDER: readonly MembershipRole[] = ['OWNER', 'MANAGER', 'STAFF'];

/** Родительный падеж — для строки отказа «доступ есть у владельца и управляющего» */
const GENITIVE: Readonly<Record<MembershipRole, string>> = {
  OWNER: 'владельца',
  MANAGER: 'управляющего',
  STAFF: 'администратора',
};

/**
 * Корректировка счёта на уменьшение приравнена к возврату и сторно (ADR-101): иначе запрет «вернуть деньги и снять штраф
 * — владелец и управляющий» обходился бы одной строкой «скидка −N».
 */
export const ADJUSTMENT_DOWN_MESSAGE =
  'Корректировку счёта на уменьшение делают владелец и управляющий — как возврат и сторно.';

/**
 * Тариф брони — её цена и правило штрафа (Q-197, ответ владельца 27.09.2026 — «нет не могут»): у существующей брони его
 * меняют владелец и управляющий (право `rates`), администратор меняет даты и место в том же тарифе.
 */
export const RATE_PLAN_CHANGE_MESSAGE =
  'Тариф у брони меняют владелец и управляющий: администратор меняет даты и место в том же тарифе.';

/** Бронь из Exely без тарифа: выбрать тариф — выбрать цену и штраф; до ответа на Q-198 — владелец и управляющий */
export const RATE_PLAN_UNKNOWN_MESSAGE =
  'У брони нет тарифа (перенесена из Exely): назначить его могут владелец и управляющий.';

/** Права роли, по порядку таблицы. Неизвестная роль — ничего */
export function permissionsOf(role: MembershipRole | null | undefined): Permission[] {
  const granted = role ? ROLE_PERMISSIONS[role] : undefined;
  return granted ? ALL.filter((p) => granted.includes(p)) : [];
}

/** Есть ли у роли право. Неизвестная или пустая роль не открывает ничего: не знаем — закрыто */
export function can(role: MembershipRole | null | undefined, permission: Permission): boolean {
  return permissionsOf(role).includes(permission);
}

/** У каких ролей есть право — от владельца к администратору */
export function rolesWith(permission: Permission): MembershipRole[] {
  return ROLE_ORDER.filter((role) => can(role, permission));
}

/** Текст отказа: раздел и у кого доступ. Одна строка на API (403) и закрытую страницу стойки */
export function accessDeniedMessage(permission: Permission): string {
  const roles = rolesWith(permission).map((role) => GENITIVE[role]);
  const who =
    roles.length === 1
      ? `только у ${roles[0]}`
      : `у ${roles.slice(0, -1).join(', ')} и ${roles[roles.length - 1]}`;
  return `«${PERMISSIONS[permission].label}»: доступ есть ${who}.`;
}
