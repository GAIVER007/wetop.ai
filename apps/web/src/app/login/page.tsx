import { headers } from 'next/headers';
import { ApiError, authApi, type AuthInvite } from '../../lib/api';
import { clientInfo, currentSession, sessionToken } from '../../lib/session';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import { LoginForm } from './login-form';

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
 * Два входа сосуществуют (ADR-046): свой — по коду на почту, кука `wetop_session`; и Cloudflare Access
 * на app.wetop.ai (plans/wetop-domain-2026-09-14.md §3), который передаёт почту заголовком. Заголовок Access
 * только для показа — права по нему не выдаются (стойка слушает 127.0.0.1, снаружи к ней ведёт лишь туннель,
 * который сам проверяет токен Access).
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const accessEmail = (await headers()).get('cf-access-authenticated-user-email')?.trim() || null;
  const q = normalizeSearchParams(await searchParams);
  const session = await currentSession();
  return (
    <LoginForm
      demo={process.env.NODE_ENV !== 'production' && process.env.APP_DEMO_MODE === '1'}
      accessEmail={accessEmail}
      session={session}
      invites={session ? await pendingInvites() : []}
      // после принятия приглашения: почта уже известна, код уже выслан — сразу шаг кода
      initialEmail={q.email ?? ''}
      initialStep={q.step === 'code' && q.email ? 'code' : 'email'}
    />
  );
}
