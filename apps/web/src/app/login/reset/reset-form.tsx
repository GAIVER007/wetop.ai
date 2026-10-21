'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { AuthShell } from '../../../components/auth-shell';
import { Icon } from '../../../components/icon';
import { requestReset, type ResetRequestState } from '../actions';
import { Input } from '../../../components/ui';

export function ResetRequestForm() {
  const [state, submit, pending] = useActionState<ResetRequestState, FormData>(requestReset, {
    error: null,
    sent: false,
  });
  return (
    <AuthShell
      story={{
        eyebrow: 'Доступ к рабочему месту',
        title: (
          <>
            Забыли пароль? <br /> Это решаемо.
          </>
        ),
        text: 'Пришлём ссылку на почту. Новый пароль вы придумаете сами.',
      }}
    >
      <span className="round-icon">
        <Icon name="shield" />
      </span>
      {state.sent ? (
        <>
          <h2>Проверьте почту</h2>
          <p>
            Если такая почта есть в системе, письмо со ссылкой уже отправлено. Ссылка работает 24
            часа и только один раз.
          </p>
          <Link className="btn" href="/login">
            Вернуться к входу
            <Icon name="arrow" width={16} />
          </Link>
        </>
      ) : (
        <>
          <h2>Смена пароля</h2>
          <p>Укажите рабочую почту</p>
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
                {state.error}
              </p>
            )}
            <button className="btn" type="submit" disabled={pending}>
              {pending ? 'Отправляем…' : 'Прислать ссылку'}
              <Icon name="arrow" width={16} />
            </button>
          </form>
          <div className="login-preview">
            <span>Вспомнили пароль?</span>
            <Link href="/login">Войти</Link>
          </div>
        </>
      )}
    </AuthShell>
  );
}
