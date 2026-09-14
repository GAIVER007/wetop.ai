import { headers } from 'next/headers';
import { LoginForm } from './login-form';

/**
 * На app.wetop.ai вход делает Cloudflare Access (plans/wetop-domain-2026-09-14.md §3): до стойки доходит только вошедший,
 * а почту Access передаёт заголовком. Заголовок только для показа — права по нему не выдаются (стойка слушает 127.0.0.1,
 * снаружи к ней ведёт лишь туннель, который сам проверяет токен Access).
 */
export default async function LoginPage() {
  const accessEmail = (await headers()).get('cf-access-authenticated-user-email')?.trim() || null;
  return (
    <LoginForm
      demo={process.env.NODE_ENV !== 'production' && process.env.APP_DEMO_MODE === '1'}
      accessEmail={accessEmail}
    />
  );
}
