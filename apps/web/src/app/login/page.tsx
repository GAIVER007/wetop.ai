import { ApiError, authApi, type AuthInvite } from '../../lib/api';
import { clientInfo, sessionToken } from '../../lib/session';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
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
 * Экран входа. Замок один — своя сессия: Cloudflare Access снят 20.09.2026 (ADR-053, ADR-045 отменён),
 * заголовок с почтой от него больше не приходит, но чтение оставлено безвредным на случай возврата Access.
 * Способ входа выбран владельцем — пароль (Q-146 закрыт, ADR-053, DATA_MODEL §13.8). Режим `code` и
 * регистрация организации пока живут здесь же: подтверждение почты при регистрации идёт тем же кодом,
 * поэтому разделение этих сценариев вынесено в отдельную правку.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = normalizeSearchParams(await searchParams);
  const user = await signedInUser();
  const mode: LoginMode = q.mode === 'code' || (q.step === 'code' && q.email) ? 'code' : 'password';
  return (
    <LoginForm
      demo={process.env.NODE_ENV !== 'production' && process.env.APP_DEMO_MODE === '1'}
      accessEmail={await accessEmail()}
      user={user}
      invites={user?.organization ? await pendingInvites() : []}
      initialEmail={q.email ?? ''}
      initialStep={q.step === 'code' && q.email ? 'code' : 'email'}
      passwordJustSet={q.password === 'set'}
      mode={mode}
    />
  );
}
