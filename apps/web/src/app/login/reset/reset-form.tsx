'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { AuthShell } from '../../../components/auth-shell';
import { Icon } from '../../../components/icon';
import { requestReset, type ResetRequestState } from '../actions';
import { Input } from '../../../components/ui';
import { useT } from '../../../i18n/locale-provider';

export function ResetRequestForm() {
  const t = useT();
  const [state, submit, pending] = useActionState<ResetRequestState, FormData>(requestReset, {
    error: null,
    sent: false,
  });
  return (
    <AuthShell
      story={{
        eyebrow: t('Доступ к рабочему месту'),
        title: (
          <>
            {t('Забыли пароль?')} <br /> {t('Это решаемо.')}
          </>
        ),
        text: t('Пришлём ссылку на почту. Новый пароль вы придумаете сами.'),
      }}
    >
      <span className="round-icon">
        <Icon name="shield" />
      </span>
      {state.sent ? (
        <>
          <h2>{t('Проверьте почту')}</h2>
          <p>
            {t(
              'Если такая почта есть в системе, письмо со ссылкой уже отправлено. Ссылка работает 24 часа и только один раз.',
            )}
          </p>
          <Link className="btn" href="/login">
            {t('Вернуться к входу')}
            <Icon name="arrow" width={16} />
          </Link>
        </>
      ) : (
        <>
          <h2>{t('Смена пароля')}</h2>
          <p>{t('Укажите рабочую почту')}</p>
          <form action={submit}>
            <label className="field">
              Email
              <Input
                type="email"
                name="email"
                autoComplete="username"
                placeholder="you@hotel.com"
                required
              />
            </label>
            {state.error && (
              <p className="alert" role="alert">
                {t(state.error)}
              </p>
            )}
            <button className="btn" type="submit" disabled={pending}>
              {pending ? t('Отправляем…') : t('Прислать ссылку')}
              <Icon name="arrow" width={16} />
            </button>
          </form>
          <div className="login-preview">
            <span>{t('Вспомнили пароль?')}</span>
            <Link href="/login">{t('Войти')}</Link>
          </div>
        </>
      )}
    </AuthShell>
  );
}
