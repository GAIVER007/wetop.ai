import { headers } from 'next/headers';
import { authApi, ApiError } from '../../lib/api';
import { LoginForm } from './login-form';

/**
 * Экран входа (DATA_MODEL §13 шаг 1, ADR-046). Два замка, не один: снаружи стойку закрывает Cloudflare
 * Access (ADR-045), а дальше система спрашивает свой логин и пароль. Почту, под которой пропустил Access,
 * показываем и подставляем в поле — но она сама по себе никуда не пускает.
 */
export default async function LoginPage() {
  const accessEmail = (await headers()).get('cf-access-authenticated-user-email')?.trim() || null;
  const me = await authApi.me().catch((error: unknown) => {
    if (error instanceof ApiError) return { user: null };
    throw error;
  });
  return (
    <LoginForm
      demo={process.env.NODE_ENV !== 'production' && process.env.APP_DEMO_MODE === '1'}
      accessEmail={accessEmail}
      user={me.user ?? null}
    />
  );
}
