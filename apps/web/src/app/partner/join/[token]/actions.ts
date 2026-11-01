'use server';
import { redirect } from 'next/navigation';
import { authApi, partnerApi } from '../../../../lib/api';
import { ApiError } from '../../../../lib/api-error';
import { clientInfo } from '../../../../lib/session';

/**
 * Регистрация партнёра по приглашению (DATA_MODEL §63.3): учётка, затем обычное письмо подтверждения почты и экран
 * «Проверьте почту»; после подтверждения партнёр входит обычным «Войти» и попадает в кабинет партнёра.
 */
export async function joinPartnerAction(token: string, _prev: { error: string } | null, form: FormData): Promise<{ error: string } | null> {
  const text = (k: string) => String(form.get(k) ?? '').trim();
  let email: string;
  let sent = false;
  // повтор пароля проверяем и здесь: ошибка видна сразу, без запроса
  if (String(form.get('passwordConfirm') ?? '') !== String(form.get('password') ?? '')) return { error: 'Пароли не совпадают' };
  try {
    const r = await partnerApi.join(token, {
      name: text('name'),
      email: text('email'),
      password: String(form.get('password') ?? ''),
      passwordConfirm: String(form.get('passwordConfirm') ?? ''),
      phone: text('phone'),
      privacyAccepted: form.get('privacyAccepted') === 'on',
    });
    email = r.email;
    // письмо подтверждения тем же путём, что у регистрации бизнеса
    await authApi.resendVerification({ email }, await clientInfo()).then(() => (sent = true), () => (sent = false));
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Не получилось. Повторите через минуту.' };
  }
  redirect(`/login/check-email?email=${encodeURIComponent(email)}${sent ? '' : '&sent=0'}`);
}
