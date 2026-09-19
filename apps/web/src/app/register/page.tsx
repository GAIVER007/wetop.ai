import { LoginForm } from '../login/login-form';
import { accessEmail, signedInUser } from '../login/signed-in';

/** Сюда ведёт «Попробовать бесплатно» с wetop.ai (срез 13, ADR-046). Та же форма, открытая на регистрации. */
export default async function RegisterPage() {
  return (
    <LoginForm demo={false} accessEmail={await accessEmail()} user={await signedInUser()} mode="register" />
  );
}
