'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { INVITE_ROLE_MESSAGE, parseInviteRole } from '@pms/domain';
import { ApiError, authApi } from '../../lib/api';
import { clearSessionCookie, clientInfo, sessionToken, setSessionCookie } from '../../lib/session';
import { publicAuthUrl, safeReturnPath } from '../../lib/auth-entry';

/**
 * Серверные действия экрана входа. Два входа живут рядом, пока владелец не выбрал (Q-146):
 * пароль (DATA_MODEL §13.8, ADR-049) и одноразовый код на почту с регистрацией организации
 * (ADR-046). Кука одна, «Выйти» одно: API узнаёт сессию любого входа.
 */
export interface LoginState {
  error: string | null;
}

/**
 * Вход по паролю: форма → API → cookie → рабочий день.
 * Текст ошибки берём от API как есть: он один и тот же для неверной почты и неверного пароля.
 */
export async function signIn(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!email || !password) return { error: 'Введите почту и пароль' };

  try {
    const result = await authApi.login({ email, password }, await clientInfo());
    await setSessionCookie(result.token, result.expiresAt);
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
  redirect(safeReturnPath(form.get('next')));
}

/** «Выйти»: сессия отзывается в базе (ключ мёртв, даже если его скопировали), cookie удаляется. Access — отдельный замок. */
export async function signOut(): Promise<void> {
  await authApi.logout().catch(() => undefined);
  await clearSessionCookie();
  redirect(publicAuthUrl());
}

export interface ResetRequestState {
  error: string | null;
  sent: boolean;
}

/**
 * «Забыли пароль». Сообщение не говорит, нашлась ли почта: иначе форма рассказывает, кто есть в системе.
 */
export async function requestReset(
  _prev: ResetRequestState,
  form: FormData,
): Promise<ResetRequestState> {
  const email = String(form.get('email') ?? '').trim();
  if (!email) return { error: 'Введите почту', sent: false };
  try {
    await authApi.requestReset({ email }, await clientInfo());
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message, sent: false };
    throw error;
  }
  return { error: null, sent: true };
}

export interface SetPasswordState {
  error: string | null;
}

/** Пароль по ссылке из письма: человек задаёт его себе сам, ссылка после этого не работает. */
export async function setPassword(
  _prev: SetPasswordState,
  form: FormData,
): Promise<SetPasswordState> {
  const token = String(form.get('token') ?? '');
  const password = String(form.get('password') ?? '');
  const again = String(form.get('again') ?? '');
  if (!token) return { error: 'Ссылка неполная: откройте её из письма целиком' };
  if (password !== again) return { error: 'Пароли не совпадают' };
  try {
    await authApi.confirmReset({ token, password }, await clientInfo());
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
  const destination = new URL(publicAuthUrl());
  destination.searchParams.set('password', 'set');
  redirect(destination.toString());
}

// ── Вход по коду на почту и регистрация (ADR-046) ──

export interface AuthActionResult {
  error: string | null;
}

/** Текст для человека: своё сообщение API — как есть, сбой связи — одной фразой. */
function errorText(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return 'Нет связи с сервером. Попробуйте ещё раз.';
}

// Вход по коду на почту снят 20.09.2026 (ADR-053): requestCodeAction и verifyAction ушли вместе с ним.

/**
 * Регистрация: почта, имя, название отеля, пароль, телефон и согласие с политикой (ADR-053, ADR-060;
 * форма 29.09.2026). Сессия здесь не открывается: API шлёт письмо, и человек уходит на экран «подтвердите почту».
 */
export async function registerAction(input: {
  email: string;
  name: string;
  hotelName: string;
  password: string;
  phoneCountry: string;
  phone: string;
  privacyAccepted: boolean;
}): Promise<AuthActionResult> {
  const { email } = input;
  let sent: boolean;
  try {
    const result = await authApi.register(input, await clientInfo());
    sent = result.sent;
  } catch (e) {
    return { error: errorText(e) };
  }
  // `redirect` бросает служебное исключение — снаружи `try`, чтобы не принять его за ошибку.
  redirect(`/login/check-email?email=${encodeURIComponent(email)}${sent ? '' : '&sent=0'}`);
}

/**
 * Подтверждение почты по ссылке из письма: API проверяет ссылку и сразу отдаёт сессию — пароль
 * человек назвал при регистрации, спрашивать его второй раз незачем.
 */
export async function verifyEmailAction(token: string): Promise<AuthActionResult> {
  try {
    const result = await authApi.verifyEmail({ token }, await clientInfo());
    await setSessionCookie(result.token, result.expiresAt);
  } catch (e) {
    return { error: errorText(e) };
  }
  redirect('/today');
}

export interface ResendState {
  error: string | null;
  sent: boolean;
}

/** «Выслать письмо заново». Ответ не говорит, есть ли такая почта: иначе форма проверяет чужие адреса. */
export async function resendVerification(_prev: ResendState, form: FormData): Promise<ResendState> {
  const email = String(form.get('email') ?? '').trim();
  if (!email) return { error: 'Введите почту', sent: false };
  try {
    await authApi.resendVerification({ email }, await clientInfo());
  } catch (e) {
    return { error: errorText(e), sent: false };
  }
  return { error: null, sent: true };
}

export interface InviteActionResult {
  error: string | null;
  /** Кого позвали — для строки «приглашение отправлено». */
  email: string | null;
}

/**
 * Пригласить по почте с ролью (срез 13, этап 7; роль — ADR-107). Ошибки формы и отказ по роли приходят текстом из API;
 * без сессии — тоже текстом. Непонятная роль из формы — отказ теми же словами, что у API, а не приглашение администратора.
 */
export async function inviteAction(email: string, role: string): Promise<InviteActionResult> {
  const token = await sessionToken();
  if (!token) return { error: 'Сеанс закончился. Войдите заново.', email: null };
  const invited = parseInviteRole(role);
  if (!invited) return { error: INVITE_ROLE_MESSAGE, email: null };
  try {
    const invite = await authApi.invite(token, email, invited, await clientInfo());
    revalidatePath('/profile/access');
    revalidatePath('/team');
    revalidatePath('/staff');
    return { error: null, email: invite.email };
  } catch (e) {
    return { error: errorText(e), email: null };
  }
}

export interface TeamActionResult {
  error: string | null;
}

/** Действие над сотрудником или приглашением (ADR-107): сессия, вызов, обновить блок «Сотрудники» */
async function teamAction(run: (token: string) => Promise<void>): Promise<TeamActionResult> {
  const token = await sessionToken();
  if (!token) return { error: 'Сеанс закончился. Войдите заново.' };
  try {
    await run(token);
  } catch (e) {
    return { error: errorText(e) };
  }
  revalidatePath('/profile/access');
  revalidatePath('/team');
  revalidatePath('/staff');
  return { error: null };
}

/** Отозвать ожидающее приглашение: ссылка больше не откроется */
export async function revokeInviteAction(id: string): Promise<TeamActionResult> {
  return teamAction(async (token) => authApi.revokeInvite(token, id, await clientInfo()));
}

/** Отключить сотрудника: членство удаляется, его сеансы в этой организации гаснут */
export async function removeMemberAction(userId: string): Promise<TeamActionResult> {
  return teamAction(async (token) => authApi.removeMember(token, userId, await clientInfo()));
}

/** Сменить роль между управляющим и администратором — только владелец */
export async function setMemberRoleAction(userId: string, role: string): Promise<TeamActionResult> {
  const next = parseInviteRole(role);
  if (!next) return { error: 'Роль сотрудника — «управляющий» или «администратор».' };
  return teamAction(async (token) =>
    authApi.setMemberRole(token, userId, next, await clientInfo()),
  );
}

/**
 * Принять приглашение по ссылке: членство заведено, а вместе с ним человек получает одноразовый ключ
 * и сразу задаёт себе пароль (ADR-053). Письма в этом пути нет: сама ссылка-приглашение и есть
 * доказательство, что перед нами приглашённый. Если пароль у него уже есть (позвали во вторую
 * организацию), ключа не будет — тогда обычный экран входа. Мёртвая ссылка — текст API на той же странице.
 */
export async function acceptInviteAction(rawToken: string): Promise<AuthActionResult> {
  let invite: { email: string; setPasswordToken?: string | null };
  try {
    invite = await authApi.acceptInvite(rawToken, await clientInfo());
  } catch (e) {
    return { error: errorText(e) };
  }
  redirect(
    invite.setPasswordToken
      ? `/login/set-password?token=${encodeURIComponent(invite.setPasswordToken)}`
      : `/login?email=${encodeURIComponent(invite.email)}`,
  );
}

/**
 * «Выйти везде» (§13.5): все сессии человека отозваны в API, включая эту, каким бы входом они ни были
 * открыты; кука прочь; на форму входа. Сбой API куку не спасает — человек просил выйти.
 */
export async function logoutAllAction(): Promise<void> {
  const token = await sessionToken();
  if (token) await authApi.logoutAll(token, await clientInfo()).catch(() => undefined);
  await clearSessionCookie();
  redirect(publicAuthUrl());
}
