import { headers } from 'next/headers';
import { currentSession } from '../../lib/session';
import { LoginForm } from '../login/login-form';

/** Сюда ведёт «Попробовать бесплатно» с wetop.ai (срез 13, этап 9). Та же форма, открытая на регистрации. */
export default async function RegisterPage() {
  const accessEmail = (await headers()).get('cf-access-authenticated-user-email')?.trim() || null;
  return (
    <LoginForm
      demo={false}
      accessEmail={accessEmail}
      session={await currentSession()}
      mode="register"
    />
  );
}
