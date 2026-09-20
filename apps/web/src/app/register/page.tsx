import { LoginForm } from '../login/login-form';
import { accessEmail, registrationAvailable, signedInUser } from '../login/signed-in';

/** Сюда ведёт «Попробовать бесплатно» с wetop.ai (срез 13, ADR-046). Та же форма, открытая на регистрации. */
export default async function RegisterPage() {
  const [user, registrationEnabled] = await Promise.all([signedInUser(), registrationAvailable()]);
  return (
    <LoginForm
      demo={false}
      accessEmail={await accessEmail()}
      user={user}
      mode="register"
      registrationEnabled={registrationEnabled}
    />
  );
}
