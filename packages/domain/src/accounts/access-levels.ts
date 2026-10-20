import { normalizeEmail, isEmailShaped } from './email';
import { can } from './permissions';
import type { InviteRole, MembershipRole } from './roles';

/**
 * Доступ при добавлении сотрудника (решение владельца 20.10.2026, docs/decisions/2026-10-20-staff-access-levels.md).
 * Четыре уровня в форме «Новый сотрудник» всех направлений: без входа, личный кабинет (только своё), администратор,
 * управляющий. Уровень с входом даёт приглашение на почту с ролью уровня; после принятия аккаунт сам привязывается к
 * сотруднику. Права ролей по-прежнему в `permissions.ts`; здесь только выбор уровня, подписи и «что увидит».
 */
export const ACCESS_LEVELS = ['NONE', 'PORTAL', 'STAFF', 'MANAGER'] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

const LEVEL_ROLE: Readonly<Record<AccessLevel, InviteRole | null>> = {
  NONE: null,
  PORTAL: 'EMPLOYEE',
  STAFF: 'STAFF',
  MANAGER: 'MANAGER',
};

/** Роль приглашения уровня; «Без входа» приглашения не даёт */
export function inviteRoleOfLevel(level: AccessLevel): InviteRole | null {
  return LEVEL_ROLE[level];
}

/** Уровень по роли уже вошедшего человека; владелец отдельно */
export function levelOfRole(role: MembershipRole): AccessLevel | 'OWNER' {
  if (role === 'OWNER') return 'OWNER';
  return role === 'EMPLOYEE' ? 'PORTAL' : role;
}

/** Специалист (мастер, официант) и «оба» по умолчанию получают кабинет, другой сотрудник без входа */
export function defaultAccessLevel(kind: string | null | undefined): AccessLevel {
  return kind === 'SPECIALIST' || kind === 'BOTH' ? 'PORTAL' : 'NONE';
}

/** Какие уровни может выдать этот человек: владелец все, управляющий без «Управляющего», остальные никакие */
export function accessLevelsFor(actor: MembershipRole): AccessLevel[] {
  if (!can(actor, 'staff')) return [];
  return can(actor, 'owner') ? [...ACCESS_LEVELS] : ACCESS_LEVELS.filter((l) => l !== 'MANAGER');
}

export interface AccessLevelInfo {
  label: string;
  /** одна строка под названием */
  hint: string;
  /** что человек увидит в WETOP */
  sees: string[];
  /** чего не увидит (для администратора и управляющего) */
  denies: string[];
}

type Vertical = 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE';

const WORDS: Readonly<Record<Vertical, { own: string; work: string[] }>> = {
  BEAUTY: { own: 'Свои записи', work: ['Журнал и записи', 'Клиенты', 'Касса и оплаты', 'Отчёты на просмотр'] },
  FOOD_SERVICE: { own: 'Свои заказы', work: ['Зал, брони и заказы', 'Гости', 'Касса', 'Отчёты на просмотр'] },
  HOSPITALITY: { own: 'Свои брони', work: ['Шахматка', 'Брони и гости', 'Оплаты и счета', 'Отчёты на просмотр'] },
};

/** Подписи и «что увидит» уровней словами направления */
export function accessLevelInfo(vertical: string): Readonly<Record<AccessLevel, AccessLevelInfo>> {
  const w = WORDS[(vertical in WORDS ? vertical : 'HOSPITALITY') as Vertical];
  return {
    NONE: {
      label: 'Без входа',
      hint: 'В WETOP не входит',
      sees: [],
      denies: [],
    },
    PORTAL: {
      label: 'Личный кабинет',
      hint: 'Видит только своё',
      sees: [w.own, 'Свой график', 'Своя зарплата', 'Свои отзывы'],
      denies: ['Чужие данные', 'Касса и отчёты', 'Настройки'],
    },
    STAFF: {
      label: 'Администратор',
      hint: 'Ежедневная работа',
      sees: w.work,
      denies: ['Возвраты', 'Цены и настройки', 'Сотрудники и доступ'],
    },
    MANAGER: {
      label: 'Управляющий',
      hint: 'Всё, кроме владельческого',
      sees: ['Всё, что у администратора', 'Возвраты', 'Цены и настройки', 'Сотрудники и доступ'],
      denies: ['Платные расширения и управляющие', 'История действий'],
    },
  };
}

export interface StaffAccess {
  role: InviteRole;
  email: string;
  /** true: вся организация; false: только филиал, где сотрудника добавили */
  allBranches: boolean;
}

export const ACCESS_LEVEL_MESSAGE = 'Выберите уровень доступа.';
export const ACCESS_EMAIL_MESSAGE = 'Для входа в WETOP укажите почту: на неё придёт приглашение.';
export const ACCESS_LEVEL_FORBIDDEN_MESSAGE = 'Этот уровень доступа выдаёт только владелец.';
export const INVITE_EMPLOYEE_MISSING_MESSAGE = 'Сотрудник не найден в вашей организации.';
export const INVITE_EMPLOYEE_LINKED_MESSAGE = 'У сотрудника уже есть вход в WETOP.';
export const ACCESS_ALL_BRANCHES_MESSAGE =
  'Доступ ко всем филиалам выдаёт сотрудник без ограничения по филиалам.';

/** Блок «Доступ в WETOP» из тела создания сотрудника; `null`: без входа */
export function parseStaffAccess(
  raw: unknown,
  ctx: { actor: MembershipRole; actorRestricted: boolean },
): { ok: true; access: StaffAccess | null } | { ok: false; message: string } {
  if (raw === undefined || raw === null) return { ok: true, access: null };
  const o = (typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const level = o.level;
  if (typeof level !== 'string' || !(ACCESS_LEVELS as readonly string[]).includes(level))
    return { ok: false, message: ACCESS_LEVEL_MESSAGE };
  const role = inviteRoleOfLevel(level as AccessLevel);
  if (!role) return { ok: true, access: null };
  if (!accessLevelsFor(ctx.actor).includes(level as AccessLevel))
    return { ok: false, message: ACCESS_LEVEL_FORBIDDEN_MESSAGE };
  const email = typeof o.email === 'string' ? normalizeEmail(o.email) : '';
  if (!email || !isEmailShaped(email)) return { ok: false, message: ACCESS_EMAIL_MESSAGE };
  const allBranches = o.allBranches === true;
  if (allBranches && ctx.actorRestricted) return { ok: false, message: ACCESS_ALL_BRANCHES_MESSAGE };
  return { ok: true, access: { role, email, allBranches } };
}
