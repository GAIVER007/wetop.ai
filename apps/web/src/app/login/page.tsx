import { LoginForm, type LoginMode } from './login-form';
import { accessEmail, signedInUser } from './signed-in';

/**
 * Экран входа. Замка два: снаружи стойку закрывает Cloudflare Access (ADR-045), внутри — своя сессия.
 * Своих входов тоже два, пока владелец не выбрал (Q-146): по паролю (DATA_MODEL §13.8, ADR-049) —
 * по умолчанию, и по коду на почту с регистрацией организации (ADR-046) — по переключателю или
 * `?mode=code`. Почту из заголовка Access показываем и подставляем в поле, но сама по себе она
 * никуда не пускает.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const passwordJustSet = sp['password'] === 'set';
  const mode: LoginMode = sp['mode'] === 'code' ? 'code' : 'password';
  return (
    <LoginForm
      demo={process.env.NODE_ENV !== 'production' && process.env.APP_DEMO_MODE === '1'}
      accessEmail={await accessEmail()}
      user={await signedInUser()}
      passwordJustSet={passwordJustSet}
      mode={mode}
    />
  );
}
