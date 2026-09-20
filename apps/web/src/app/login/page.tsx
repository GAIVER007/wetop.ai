import { ApiError, authApi, type AuthInvite } from '../../lib/api';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import { clientInfo, sessionToken } from '../../lib/session';
import { LoginForm, type LoginMode } from './login-form';
import { accessEmail, signedInUser } from './signed-in';

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

/**
 * Экран входа. Замка два: снаружи стойку закрывает Cloudflare Access (ADR-045), внутри — своя сессия.
 * Своих входов тоже два, пока владелец не выбрал (Q-146): по паролю (DATA_MODEL §13.8, ADR-049) —
 * по умолчанию, и по коду на почту с регистрацией организации (ADR-046) — по переключателю или
 * `?mode=code`. Почту из заголовка Access показываем и подставляем в поле, но сама по себе она
 * никуда не пускает.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = normalizeSearchParams(await searchParams);
  const passwordJustSet = q['password'] === 'set';
  // после принятия приглашения: почта уже известна, код уже выслан — сразу шаг кода
  const initialStep = q['step'] === 'code' && q['email'] ? 'code' : 'email';
  const mode: LoginMode = q['mode'] === 'code' || initialStep === 'code' ? 'code' : 'password';
  const user = await signedInUser();
  return (
    <LoginForm
      demo={process.env.NODE_ENV !== 'production' && process.env.APP_DEMO_MODE === '1'}
      accessEmail={await accessEmail()}
      user={user}
      passwordJustSet={passwordJustSet}
      mode={mode}
      invites={user ? await pendingInvites() : []}
      initialEmail={q['email'] ?? ''}
      initialStep={initialStep}
    />
  );
}
