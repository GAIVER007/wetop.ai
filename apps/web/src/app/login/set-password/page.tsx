import { SetPasswordForm } from './set-password-form';

/**
 * Пароль по ссылке из письма (DATA_MODEL §13 шаг 1, ADR-046). Токен приходит в запросе и уходит обратно в
 * API скрытым полем формы: сам пароль человек задаёт себе, владелец его не знает.
 */
export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params['token'];
  const token = (Array.isArray(raw) ? raw[0] : raw) ?? '';
  return <SetPasswordForm token={token} />;
}
