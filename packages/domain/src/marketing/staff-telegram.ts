import { createHash } from 'node:crypto';
import { canAt, roleAt, type ScopeAssignment, type ScopeTarget } from '../accounts/scopes';
import type { MembershipRole } from '../accounts/roles';
import { beautyPermissionScope, resolveBeautyPositionAccess, type BeautyAssignment } from '../beauty/access';

/**
 * Уведомления сотрудникам о бронях с сайта в Telegram (STAFF-TG-20261020, DATA_MODEL, план
 * `plans/staff-telegram-notifications-2026-10-20.md`). Чистые правила: одноразовый код привязки, разбор команд бота,
 * пауза повторов, ссылка «Открыть в WETOP» и кто получает сообщение. Текст сообщения: `site-notification.ts`.
 */

export type StaffNotificationKind = 'SITE_BOOKING_HOTEL' | 'SITE_APPOINTMENT' | 'SITE_TABLE' | 'SITE_LEAD';

/** 32 знака без похожих 0/O, 1/I: код можно продиктовать и ввести руками */
export const STAFF_LINK_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const STAFF_LINK_CODE_LENGTH = 8;
export const STAFF_LINK_CODE_TTL_MS = 15 * 60_000;
export const STAFF_NOTIFY_MAX_ATTEMPTS = 6;

/** Код из случайных байт: 32 знака делят 256 нацело, поэтому распределение равномерное */
export function newStaffLinkCode(randomBytes: (n: number) => Uint8Array): string {
  const bytes = randomBytes(STAFF_LINK_CODE_LENGTH);
  let code = '';
  for (let i = 0; i < STAFF_LINK_CODE_LENGTH; i += 1) code += STAFF_LINK_CODE_ALPHABET[bytes[i]! % 32];
  return code;
}

/** Код из `/start <код>` или ручного ввода: регистр и края не важны, остальное строго */
export function normalizeStaffLinkCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  if (code.length !== STAFF_LINK_CODE_LENGTH) return null;
  return [...code].every((ch) => STAFF_LINK_CODE_ALPHABET.includes(ch)) ? code : null;
}

/** В базе только SHA-256 кода: утечка базы не даёт привязать чужой чат */
export function staffLinkCodeHash(code: string): string {
  return createHash('sha256').update(`staff-telegram:${code}`).digest('hex');
}

export type StaffBotCommand =
  | { kind: 'start'; code: string | null; chatId: string; username: string | null }
  | { kind: 'stop'; chatId: string }
  | { kind: 'other'; chatId: string }
  | { kind: 'ignore' };

/**
 * Обновление Telegram (Update → message): только личный чат (`chat.type = private`), команды `/start [код]` и `/stop`,
 * в том числе в форме `/start@имя_бота`. Номер чата строкой: он больше 2^31 и в JSON приходит числом до 52 бит.
 */
export function parseStaffBotUpdate(raw: unknown): StaffBotCommand {
  const message = (raw as { message?: unknown } | null)?.message as
    | { chat?: { id?: unknown; type?: unknown; username?: unknown }; text?: unknown }
    | undefined;
  const chat = message?.chat;
  if (!chat || chat.type !== 'private') return { kind: 'ignore' };
  if (typeof chat.id !== 'number' && typeof chat.id !== 'string') return { kind: 'ignore' };
  const chatId = String(chat.id);
  if (!/^[1-9]\d{0,18}$/.test(chatId)) return { kind: 'ignore' };
  const text = typeof message.text === 'string' ? message.text.trim() : '';
  const [head = '', ...rest] = text.split(/\s+/);
  const command = head.toLowerCase().replace(/@[a-z0-9_]+$/i, '');
  if (command === '/start') {
    const username = typeof chat.username === 'string' && chat.username.trim() ? chat.username.trim().slice(0, 64) : null;
    return { kind: 'start', code: normalizeStaffLinkCode(rest.join('')), chatId, username };
  }
  if (command === '/stop') return { kind: 'stop', chatId };
  return { kind: 'other', chatId };
}

/**
 * Пауза перед следующей попыткой после `attempts` неудачных: 1, 3, 7, 15, 30 минут. Шесть попыток (первая и пять
 * повторов) укладываются примерно в час, как обещано в плане.
 */
export function staffNotifyRetryDelayMs(attempts: number): number {
  const minutes = [1, 3, 7, 15, 30];
  return minutes[Math.min(Math.max(attempts, 1), minutes.length) - 1]! * 60_000;
}

export type StaffLinkTarget =
  | { kind: 'SITE_BOOKING_HOTEL'; confirmationNumber: string }
  | { kind: 'SITE_APPOINTMENT'; date: string }
  | { kind: 'SITE_TABLE'; date: string }
  | { kind: 'SITE_LEAD' };

/** «Открыть в WETOP»: карточка брони гостиницы, день журнала салона или броней ресторана, заявки в «Продажах» */
export function staffNotificationLink(appUrl: string, target: StaffLinkTarget): string {
  const base = appUrl.replace(/\/+$/, '');
  switch (target.kind) {
    case 'SITE_BOOKING_HOTEL':
      return `${base}/reservations/${encodeURIComponent(target.confirmationNumber)}`;
    case 'SITE_APPOINTMENT':
      return `${base}/appointments?date=${encodeURIComponent(target.date)}`;
    case 'SITE_TABLE':
      return `${base}/table-reservations?date=${encodeURIComponent(target.date)}`;
    case 'SITE_LEAD':
      return `${base}/sales`;
  }
}

export interface StaffRecipientInput {
  kind: StaffNotificationKind;
  vertical: 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE';
  target: { businessId: string; locationId: string };
  /** `users.status = ACTIVE` */
  userActive: boolean;
  membership: { role: MembershipRole; status: 'ACTIVE' | 'SUSPENDED' } | null;
  /** Строки `membership_scopes` этого сотрудника (OWNER-строк не бывает) */
  scopes: readonly ScopeAssignment[];
  /** Назначения должностей салона (BEAUTY-ACCESS-20261018), с отозванными */
  beautyAssignments: readonly BeautyAssignment[];
  /** Сотрудник сам мастер этой записи: открывает право OWN */
  ownEmployee?: boolean;
}

/**
 * Получает ли сотрудник сообщение о событии с сайта. Существующая модель прав, без новой: членство активно, филиал в
 * области доступа (DATA_MODEL §31.1), право на раздел как у экрана, где сотрудник видит это событие:
 * - бронь гостиницы и бронь стола: право `desk` в филиале (шахматка и брони ресторана);
 * - запись салона: без должностей `desk`; с должностями право `appointments.view` (BUSINESS, или OWN для своей записи);
 * - заявка без брони: право `dialogs` («Заявки с сайта», уровень организации).
 */
export function staffNotificationRecipient(input: StaffRecipientInput): boolean {
  if (!input.userActive || !input.membership || input.membership.status !== 'ACTIVE') return false;
  const role = input.membership.role;
  const target: ScopeTarget = { businessId: input.target.businessId, locationId: input.target.locationId };
  switch (input.kind) {
    case 'SITE_LEAD':
      return canAt(role, input.scopes, 'dialogs', target);
    case 'SITE_BOOKING_HOTEL':
    case 'SITE_TABLE':
      return canAt(role, input.scopes, 'desk', target);
    case 'SITE_APPOINTMENT': {
      if (role === 'OWNER') return true;
      const here = roleAt(role, input.scopes, target);
      if (!here) return false;
      const access = resolveBeautyPositionAccess(input.beautyAssignments, input.target);
      if (access.mode === 'LEGACY') return canAt(role, input.scopes, 'desk', target);
      if (!access.assigned) return false;
      const scope = beautyPermissionScope(access.permissions, 'appointments', 'view');
      return scope === 'BUSINESS' || (scope === 'OWN' && input.ownEmployee === true);
    }
  }
}
