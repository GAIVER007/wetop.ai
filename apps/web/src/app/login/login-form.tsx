'use client';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Icon } from '../../components/icon';
import { useTheme } from '../../components/theme-provider';
import type { SignedIn } from '../../lib/api';
import { signIn, signOut, type LoginState } from './actions';

const ROLES: Record<SignedIn['role'], string> = {
  OWNER: 'владелец',
  MANAGER: 'управляющий',
  DESK: 'стойка',
  READONLY: 'только чтение',
};

export function LoginForm({
  demo,
  accessEmail,
  user,
}: {
  demo: boolean;
  accessEmail: string | null;
  user: SignedIn | null;
}) {
  const [show, setShow] = useState(false);
  const [state, submit, pending] = useActionState<LoginState, FormData>(signIn, { error: null });
  const { setTheme } = useTheme();
  return (
    <main className="login-page" id="main-content">
      <button
        className="icon-button login-theme"
        aria-label="Переключить тему"
        onClick={() =>
          setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark')
        }
      >
        <Icon name="sun" />
      </button>
      <section className="login-story">
        <Link className="workspace-brand" href="/today">
          <span className="workspace-mark">W</span>
          <span className="brand-name">
            WETOP<span>.AI</span>
          </span>
        </Link>
        <div className="login-message">
          <span className="eyebrow">Hospitality, thoughtfully connected</span>
          <h1>
            Весь объект
            <br />
            под контролем.
          </h1>
          <p>
            Брони. Гости. Оплаты. Номера.
            <br />В одной системе.
          </p>
          <div className="login-orbit" aria-hidden="true">
            <span className="ai-orb" />
          </div>
        </div>
        <span className="login-property">
          <Icon name="inventory" width={16} />
          Luxx Aparts · Алматы
        </span>
      </section>
      <section className="login-form-panel">
        <div className="login-form">
          <span className="round-icon">
            <Icon name="shield" />
          </span>
          {user ? (
            <>
              <h2>Вы вошли</h2>
              <p>
                как <b>{user.fullName}</b> · {user.email} · {ROLES[user.role]}
              </p>
              <Link className="btn" href="/today">
                Открыть рабочее место
                <Icon name="arrow" width={16} />
              </Link>
              <form action={signOut} className="login-preview">
                <span>Смена закончена?</span>
                <button type="submit">Выйти</button>
              </form>
            </>
          ) : (
            <>
              <h2>Добро пожаловать</h2>
              <p>Войдите в рабочее пространство</p>
              <form action={submit}>
                <label className="field">
                  Email
                  <input
                    className="inp"
                    type="email"
                    autoComplete="username"
                    name="email"
                    placeholder="you@hotel.com"
                    defaultValue={accessEmail ?? ''}
                    required
                  />
                </label>
                <label className="field">
                  Пароль
                  <span className="password-control">
                    <input
                      className="inp"
                      type={show ? 'text' : 'password'}
                      autoComplete="current-password"
                      name="password"
                      aria-label="Пароль"
                      required
                      placeholder="Введите пароль"
                    />
                    <button
                      type="button"
                      aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
                      onClick={() => setShow(!show)}
                    >
                      {show ? 'Скрыть' : 'Показать'}
                    </button>
                  </span>
                </label>
                {state.error && (
                  <p className="alert" role="alert">
                    {state.error}
                  </p>
                )}
                <button className="btn" type="submit" disabled={pending}>
                  {pending ? 'Проверяем…' : 'Войти'}
                  <Icon name="arrow" width={16} />
                </button>
              </form>
              <div className="login-preview">
                {accessEmail ? (
                  <>
                    <span>Cloudflare Access пропустил {accessEmail}</span>
                    {/* путь Cloudflare, не маршрут приложения: обычная ссылка, не next/link */}
                    <a href="/cdn-cgi/access/logout">Выйти из Access</a>
                  </>
                ) : (
                  <span>{demo ? 'Демонстрационный режим' : 'Пароль выдаёт владелец объекта'}</span>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
