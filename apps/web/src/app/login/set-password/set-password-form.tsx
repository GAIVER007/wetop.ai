'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { Icon } from '../../../components/icon';
import { setPassword, type SetPasswordState } from '../actions';

export function SetPasswordForm({ token }: { token: string }) {
  const [state, submit, pending] = useActionState<SetPasswordState, FormData>(setPassword, {
    error: null,
  });
  return (
    <main className="login-page" id="main-content">
      <section className="login-story">
        <Link className="workspace-brand" href="/login">
          <span className="workspace-mark">W</span>
          <span className="brand-name">
            WETOP<span>.AI</span>
          </span>
        </Link>
        <div className="login-message">
          <span className="eyebrow">Доступ к рабочему месту</span>
          <h1>
            Придумайте
            <br />
            себе пароль.
          </h1>
          <p>Его не знает никто, кроме вас: в системе хранится только отпечаток.</p>
        </div>
      </section>
      <section className="login-form-panel">
        <div className="login-form">
          <span className="round-icon">
            <Icon name="shield" />
          </span>
          {token ? (
            <>
              <h2>Новый пароль</h2>
              <p>Не короче 10 символов, не только из цифр</p>
              <form action={submit}>
                <input type="hidden" name="token" value={token} />
                <label className="field">
                  Пароль
                  <input
                    className="inp"
                    type="password"
                    name="password"
                    aria-label="Пароль"
                    autoComplete="new-password"
                    required
                  />
                </label>
                <label className="field">
                  Пароль ещё раз
                  <input
                    className="inp"
                    type="password"
                    name="again"
                    aria-label="Пароль ещё раз"
                    autoComplete="new-password"
                    required
                  />
                </label>
                {state.error && (
                  <p className="alert" role="alert">
                    {state.error}
                  </p>
                )}
                <button className="btn" type="submit" disabled={pending}>
                  {pending ? 'Сохраняем…' : 'Сохранить пароль'}
                  <Icon name="arrow" width={16} />
                </button>
              </form>
            </>
          ) : (
            <>
              <h2>Ссылка неполная</h2>
              <p>Откройте ссылку из письма целиком — в ней есть одноразовый ключ.</p>
              <Link className="btn" href="/login/reset">
                Прислать новую ссылку
                <Icon name="arrow" width={16} />
              </Link>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
