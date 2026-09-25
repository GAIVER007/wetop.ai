import { MEMBERSHIP_ROLES } from '@pms/domain';
import { CLOSED_ACCESS, deskAccessOf, type NavigationAccess } from './navigation';

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
}

export const CLOSED_SHELL: DeskShell = { access: CLOSED_ACCESS, person: null };

type MeLike = Parameters<typeof deskAccessOf>[0] & {
  user: {
    email: string;
    name: string | null;
    role?: string;
    platformAdmin?: boolean;
  } | null;
};

const capital = (text: string) => text.charAt(0).toLocaleUpperCase('ru') + text.slice(1);

/** Подпись вошедшего: имя (или почта), роль словом; главный администратор — ещё и это */
export function deskPerson(user: NonNullable<MeLike['user']>): DeskPerson {
  const name = user.name?.trim() || user.email;
  // старый API роли не присылает — показываем сотрудником: подпись не должна обещать прав, которых нет
  const role = user.role === 'OWNER' ? MEMBERSHIP_ROLES.OWNER : MEMBERSHIP_ROLES.STAFF;
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
  return { access: deskAccessOf(me), person: deskPerson(me.user) };
}
