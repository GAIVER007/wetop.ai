/*
 * Проверка полей окна входа и регистрации (аудит 22.10.2026, P1-1a). Формы окна с `noValidate`: иначе браузер
 * при пустом поле показывает своё сообщение на языке системы («Please fill out this field.»). Здесь только
 * то, что можно сказать до запроса: поле пустое, у почты нет «@», новый пароль короче 10 знаков. Остальное
 * (почта занята, слабый пароль) говорит стойка.
 */
export type AuthMode = 'login' | 'register';
export type AuthField = 'name' | 'businessName' | 'phone' | 'email' | 'password';
export type AuthFieldErrors = Partial<Record<AuthField, string>>;
export type AuthFieldTexts = {
  email: string;
  emailFormat: string;
  password: string;
  passwordShort: string;
  name: string;
  businessName: string;
  phone: string;
};

/** Порядок полей на экране: фокус уходит в первое ошибочное сверху. */
const ORDER: Record<AuthMode, AuthField[]> = {
  login: ['email', 'password'],
  register: ['name', 'businessName', 'phone', 'email', 'password'],
};

export const NEW_PASSWORD_MIN = 10;

export function authFieldErrors(
  mode: AuthMode,
  values: Record<AuthField, string>,
  texts: AuthFieldTexts,
): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  for (const field of ORDER[mode]) {
    const value = field === 'password' ? values.password : values[field].trim();
    if (!value) {
      errors[field] = texts[field];
      continue;
    }
    if (field === 'email' && !/^[^\s@]+@[^\s@]+$/.test(value)) errors.email = texts.emailFormat;
    if (field === 'password' && mode === 'register' && value.length < NEW_PASSWORD_MIN)
      errors.password = texts.passwordShort;
  }
  return errors;
}

export function firstInvalidField(mode: AuthMode, errors: AuthFieldErrors): AuthField | null {
  return ORDER[mode].find((field) => errors[field]) ?? null;
}
