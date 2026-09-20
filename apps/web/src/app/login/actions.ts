'use server';
import { redirect } from 'next/navigation';
import { ApiError, authApi } from '../../lib/api';
import {
  clearSessionCookie,
  clientInfo,
  sessionToken,
  setSessionCookie,
  storeSessionToken,
} from '../../lib/session';

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
    const result = await authApi.login({ email, password });
    await setSessionCookie(result.token, result.expiresAt);
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
  redirect('/today');
}

/** «Выйти»: сессия отзывается в базе (ключ мёртв, даже если его скопировали), cookie удаляется. Access — отдельный замок. */
export async function signOut(): Promise<void> {
  await authApi.logout().catch(() => undefined);
  await clearSessionCookie();
  redirect('/login');
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
    await authApi.requestReset({ email });
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
    await authApi.confirmReset({ token, password });
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
  redirect('/login?password=set');
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

/** Запрос кода. Ответ API одинаков для любого адреса — форма просто переходит к вводу кода. */
export async function requestCodeAction(email: string): Promise<AuthActionResult> {
  try {
    await authApi.requestCode(email, await clientInfo());
    return { error: null };
  } catch (e) {
    return { error: errorText(e) };
  }
}

/**
 * Регистрация: почта, имя, пароль (ADR-053, решение владельца 20.09.2026). Письма и кода в этом
 * пути нет — API сразу отдаёт ключ сессии, и человек оказывается на рабочем месте. Рабочее
 * пространство называется именем человека: отдельного поля в форме владелец не просил.
 */
export async function registerAction(
  email: string,
  name: string,
  password: string,
): Promise<AuthActionResult> {
  try {
    const result = await authApi.register({ email, name, password });
    await setSessionCookie(result.token, result.expiresAt);
  } catch (e) {
    return { error: errorText(e) };
  }
  // `redirect` бросает служебное исключение — снаружи `try`, чтобы не принять его за ошибку.
  redirect('/today');
}

/** Проверка кода. Удача — ключ в куку и на рабочее место; отказ — текст API, один на все причины. */
export async function verifyAction(email: string, code: string): Promise<AuthActionResult> {
  try {
    const { token } = await authApi.verify(email, code, await clientInfo());
    await storeSessionToken(token);
  } catch (e) {
    return { error: errorText(e) };
  }
  // `redirect` бросает служебное исключение — снаружи `try`, чтобы не принять его за ошибку.
  redirect('/today');
}

export interface InviteActionResult {
  error: string | null;
  /** Кого позвали — для строки «приглашение отправлено». */
  email: string | null;
}

/** Пригласить по почте (срез 13, этап 7). Ошибки формы приходят текстом из API; без сессии — тоже текстом. */
export async function inviteAction(email: string): Promise<InviteActionResult> {
  const token = await sessionToken();
  if (!token) return { error: 'Сеанс закончился. Войдите заново.', email: null };
  try {
    const invite = await authApi.invite(token, email, await clientInfo());
    return { error: null, email: invite.email };
  } catch (e) {
    return { error: errorText(e), email: null };
  }
}

/**
 * Принять приглашение по ссылке: членство заведено, код для входа ушёл на почту — дальше форма
 * входа сразу на шаге кода с этой почтой. Мёртвая ссылка — текст API на той же странице.
 */
export async function acceptInviteAction(rawToken: string): Promise<AuthActionResult> {
  let email: string;
  try {
    email = (await authApi.acceptInvite(rawToken, await clientInfo())).email;
  } catch (e) {
    return { error: errorText(e) };
  }
  redirect(`/login?email=${encodeURIComponent(email)}&step=code`);
}
