import { canManageStaff, parseMembershipRole } from '@pms/domain';
import {
  ApiError,
  authApi,
  type AuthInvite,
  type AuthMember,
  type AuthSessionRow,
} from '../../lib/api';
import { clientInfo, sessionToken } from '../../lib/session';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import { LoginForm, type LoginMode } from './login-form';
import { registrationAvailable, signedInUser } from './signed-in';

/** Ожидающие приглашения своей организации — только вошедшему; сбой списка экран входа не роняет. */
async function pendingInvites(): Promise<AuthInvite[]> {
  const token = await sessionToken();
  if (!token) return [];
  try {
    return await authApi.invites(token, await clientInfo());
  } catch (e) {
    if (e instanceof ApiError) return [];
    throw e;
  }
}

/** Сотрудники своей организации (ADR-106) — владельцу и управляющему; сбой списка экран входа не роняет. */
async function teamMembers(): Promise<AuthMember[]> {
  const token = await sessionToken();
  if (!token) return [];
  try {
    return await authApi.members(token, await clientInfo());
  } catch (e) {
    if (e instanceof ApiError) return [];
    throw e;
  }
}

/** «Где я вошёл» — живые сессии вошедшего; сбой списка экран входа тоже не роняет. */
async function activeSessions(): Promise<AuthSessionRow[]> {
  const token = await sessionToken();
  if (!token) return [];
  try {
    return await authApi.sessions(token, await clientInfo());
  } catch (e) {
    if (e instanceof ApiError) return [];
    throw e;
  }
}

/**
 * Вход по паролю (ADR-053). Доступность самостоятельной регистрации определяет API (ADR-055).
 * Прежние ссылки на регистрацию при закрытом доступе сохраняют вход сотрудников.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = normalizeSearchParams(await searchParams);
  const [user, registrationEnabled] = await Promise.all([signedInUser(), registrationAvailable()]);
  // `?mode=register` открывает регистрацию сразу — с неё ведёт ссылка «Попробовать бесплатно» с сайта.
  const mode: LoginMode = q.mode === 'register' ? 'register' : 'password';
  // приглашениями и сотрудниками ведают владелец и управляющий (ADR-106): администратору их и не запрашиваем
  const role = user?.role ? parseMembershipRole(user.role) : null;
  const team = !!user?.organization && !!role && canManageStaff(role);
  return (
    <LoginForm
      demo={process.env.NODE_ENV !== 'production' && process.env.APP_DEMO_MODE === '1'}
      user={user}
      invites={team ? await pendingInvites() : []}
      members={team ? await teamMembers() : []}
      // «Где я вошёл» — любому вошедшему, каким бы входом он ни пришёл (Q-146: API узнаёт оба)
      sessions={user ? await activeSessions() : []}
      initialEmail={q.email ?? ''}
      passwordJustSet={q.password === 'set'}
      mode={mode}
      registrationEnabled={registrationEnabled}
    />
  );
}
