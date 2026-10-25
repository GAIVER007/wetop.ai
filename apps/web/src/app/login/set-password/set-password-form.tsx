'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { AuthShell } from '../../../components/auth-shell';
import { Icon } from '../../../components/icon';
import { setPassword, type SetPasswordState } from '../actions';
import { Input } from '../../../components/ui';
import { useT } from '../../../i18n/locale-provider';

export function SetPasswordForm({ token }: { token: string }) {
  const t = useT();
  const [state, submit, pending] = useActionState<SetPasswordState, FormData>(setPassword, {
    error: null,
  });
  return (
    <AuthShell
      story={{
        eyebrow: t('Доступ к рабочему месту'),
        title: (
          <>
            {t('Придумайте')} <br /> {t('себе пароль.')}
          </>
        ),
        text: t('Его не знает никто, кроме вас: в системе хранится только отпечаток.'),
      }}
    >
      <span className="round-icon">
        <Icon name="shield" />
      </span>
      {token ? (
        <>
          <h2>{t('Новый пароль')}</h2>
          <p>{t('Не короче 10 символов, не только из цифр')}</p>
          <form action={submit}>
            <input type="hidden" name="token" value={token} />
            <label className="field">
              {t('Пароль')}
              <Input
                type="password"
                name="password"
                aria-label={t('Пароль')}
                autoComplete="new-password"
                required
              />
            </label>
            <label className="field">
              {t('Пароль ещё раз')}
              <Input
                type="password"
                name="again"
                aria-label={t('Пароль ещё раз')}
                autoComplete="new-password"
                required
              />
            </label>
            {state.error && (
              <p className="alert" role="alert">
                {t(state.error)}
              </p>
            )}
            <button className="btn" type="submit" disabled={pending}>
              {pending ? t('Сохраняем…') : t('Сохранить пароль')}
              <Icon name="arrow" width={16} />
            </button>
          </form>
        </>
      ) : (
        <>
          <h2>{t('Ссылка неполная')}</h2>
          <p>{t('Откройте ссылку из письма целиком — в ней есть одноразовый ключ.')}</p>
          <Link className="btn" href="/login/reset">
            {t('Прислать новую ссылку')}
            <Icon name="arrow" width={16} />
          </Link>
        </>
      )}
    </AuthShell>
  );
}
