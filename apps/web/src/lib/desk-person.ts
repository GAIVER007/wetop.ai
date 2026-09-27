import {
  MEMBERSHIP_ROLES,
  canWrite,
  daysLeft,
  parseMembershipRole,
  type OrganizationStatus,
} from '@pms/domain';
import { CLOSED_ACCESS, UNKNOWN_ACCESS, deskAccessOf, type NavigationAccess } from './navigation';
import { tourKeyOf } from '../components/shell/tour-steps';

/** Кто на смене — подпись в меню вместо «Администратор» (ADR-083): имя, роль и буквы для кружка */
export interface DeskPerson {
  name: string;
  caption: string;
  initials: string;
}

/** Что оболочка стойки знает о вошедшем: открытые пункты меню и подпись. Вошедшего нет — всё закрыто */
export interface DeskShell {
  access: NavigationAccess;
  person: DeskPerson | null;
  /** «Пробный период: ещё N дн.» — только у организации на пробном сроке (ТЗ ux-retention п. 2.7) */
  trial: string | null;
  /** Ключ отметки «обучение пройдено» в браузере (ADR-100); вошедшего нет — обучения нет */
  tourKey: string | null;
  /** Пробный срок вышел или организация в «только чтение» (Q-144 — Б, ADR-102): полоса над экраном */
  readOnly: boolean;
}

export const CLOSED_SHELL: DeskShell = {
  access: CLOSED_ACCESS,
  person: null,
  trial: null,
  tourKey: null,
  readOnly: false,
};

/** Нет права записи — то же правило, что у API (`canWrite` в домене). Нет организации в ответе — полосы нет. */
export function readOnlyOf(org: TrialOrganization | null | undefined, now: Date): boolean {
  if (!org) return false;
  const known: OrganizationStatus[] = ['TRIAL', 'ACTIVE', 'READ_ONLY', 'SUSPENDED'];
  if (!known.includes(org.status as OrganizationStatus)) return false;
  return !canWrite(org.status as OrganizationStatus, org.trialEndsAt ? new Date(org.trialEndsAt) : null, now);
}

interface TrialOrganization {
  status: string;
  trialEndsAt: string | null;
}

/**
 * Строка о пробном сроке организации (ADR-046, 7 дней). После срока — только факт: перехода в «только чтение» в
 * системе пока нет (Q-144), поэтому строка ничего не обещает и не пугает.
 */
export function trialLine(org: TrialOrganization | null | undefined, now: Date): string | null {
  if (!org || org.status !== 'TRIAL' || !org.trialEndsAt) return null;
  const left = daysLeft(new Date(org.trialEndsAt), now);
  return left === 0 ? 'Пробный период закончился' : `Пробный период: ещё ${left} дн.`;
}

/**
 * `/auth/me` не ответил (сбой, тайм-аут) — это не «никто не вошёл»: вошедшим может быть администратор, и меню с кнопками —
 * как у него (ADR-107). Роль `null` («не прятать») — только когда API ответил, что никто не вошёл. Страницы по адресу
 * при этом не закрываются (`pageOpen`): роль неизвестна, решает API.
 */
export const UNKNOWN_SHELL: DeskShell = {
  access: UNKNOWN_ACCESS,
  person: null,
  trial: null,
  tourKey: null,
  // статус организации тоже неизвестен: полосу «только чтение» не обещаем, запись закроет API (ADR-102)
  readOnly: false,
};

type MeLike = Parameters<typeof deskAccessOf>[0] & {
  user: {
    email: string;
    name: string | null;
    role?: string;
    platformAdmin?: boolean;
    organization?: TrialOrganization | null;
  } | null;
};

const capital = (text: string) => text.charAt(0).toLocaleUpperCase('ru') + text.slice(1);

/** Подпись вошедшего: имя (или почта), роль словом; главный администратор — ещё и это */
export function deskPerson(user: NonNullable<MeLike['user']>): DeskPerson {
  const name = user.name?.trim() || user.email;
  // роли нет (старый API) или она незнакома — администратор: подпись не должна обещать прав, которых нет
  const role = MEMBERSHIP_ROLES[(user.role && parseMembershipRole(user.role)) || 'STAFF'];
  const caption = capital(role) + (user.platformAdmin === true ? ' · главный администратор' : '');
  const words = (user.name?.trim() || user.email.split('@')[0] || '?')
    .split(/[\s._-]+/)
    .filter(Boolean);
  const initials = words
    .slice(0, 2)
    .map((w) => w.charAt(0).toLocaleUpperCase('ru'))
    .join('');
  return { name, caption, initials: initials || '?' };
}

export function deskShellOf(me: MeLike | null): DeskShell {
  if (!me?.user) return CLOSED_SHELL;
  return {
    access: deskAccessOf(me),
    person: deskPerson(me.user),
    trial: trialLine(me.user.organization, new Date()),
    tourKey: tourKeyOf(me.user.email),
    readOnly: readOnlyOf(me.user.organization, new Date()),
  };
}
