'use server';
import { redirect } from 'next/navigation';
import { ApiError, authApi } from '../../lib/api';
import { clientInfo, forgetSessionToken, sessionToken, storeSessionToken } from '../../lib/session';

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

/** Регистрация: организация с пробным периодом и код на почту. Ошибки формы приходят текстом из API. */
export async function registerAction(
  email: string,
  organizationName: string,
): Promise<AuthActionResult> {
  try {
    await authApi.register(email, organizationName, await clientInfo());
    return { error: null };
  } catch (e) {
    return { error: errorText(e) };
  }
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

/** «Выйти везде»: все сессии человека отозваны в API, включая эту; кука прочь; на форму входа. */
export async function logoutAllAction(): Promise<void> {
  const token = await sessionToken();
  if (token) {
    try {
      await authApi.logoutAll(token, await clientInfo());
    } catch {
      // API недоступен — куку всё равно снимаем; остальные сеансы отзовутся, когда API ответит повтору
    }
  }
  await forgetSessionToken();
  redirect('/login');
}

/** Выход: отметка в API (ключ мёртв, даже если его скопировали) и кука прочь. */
export async function logoutAction(): Promise<void> {
  const token = await sessionToken();
  if (token) {
    try {
      await authApi.logout(token, await clientInfo());
    } catch {
      // API недоступен — куку всё равно снимаем: человек просил выйти.
    }
  }
  await forgetSessionToken();
  redirect('/login');
}
