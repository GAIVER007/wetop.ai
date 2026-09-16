'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { Icon } from '../../../components/icon';
import { requestReset, type ResetRequestState } from '../actions';

export function ResetRequestForm() {
  const [state, submit, pending] = useActionState<ResetRequestState, FormData>(requestReset, {
    error: null,
    sent: false,
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
            Забыли пароль?
            <br />
            Это решаемо.
          </h1>
          <p>Пришлём ссылку на почту. Новый пароль вы придумаете сами.</p>
        </div>
      </section>
      <section className="login-form-panel">
        <div className="login-form">
          <span className="round-icon">
            <Icon name="shield" />
          </span>
          {state.sent ? (
            <>
              <h2>Проверьте почту</h2>
              <p>
                Если такая почта есть в системе, письмо со ссылкой уже отправлено. Ссылка работает 24 часа
                и только один раз.
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
                  <input
                    className="inp"
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
        </div>
      </section>
    </main>
  );
}
