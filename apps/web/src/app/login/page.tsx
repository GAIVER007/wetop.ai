import { headers } from 'next/headers';
import { currentSession } from '../../lib/session';
import { LoginForm } from './login-form';

/**
 * Два входа сосуществуют (ADR-046): свой — по коду на почту, кука `wetop_session`; и Cloudflare Access
 * на app.wetop.ai (plans/wetop-domain-2026-09-14.md §3), который передаёт почту заголовком. Заголовок Access
 * только для показа — права по нему не выдаются (стойка слушает 127.0.0.1, снаружи к ней ведёт лишь туннель,
 * который сам проверяет токен Access).
 */
export default async function LoginPage() {
  const accessEmail = (await headers()).get('cf-access-authenticated-user-email')?.trim() || null;
  return (
    <LoginForm
      demo={process.env.NODE_ENV !== 'production' && process.env.APP_DEMO_MODE === '1'}
      accessEmail={accessEmail}
      session={await currentSession()}
    />
  );
}
