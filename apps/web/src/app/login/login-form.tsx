'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '../../components/icon';
import { useTheme } from '../../components/theme-provider';
export function LoginForm({ demo }: { demo: boolean }) {
  const [show, setShow] = useState(false),
    [error, setError] = useState('');
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
          <h2>Добро пожаловать</h2>
          <p>Войдите в рабочее пространство</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(
                'Вход в рабочий аккаунт ещё не подключён. Используйте доступное рабочее пространство.',
              );
            }}
          >
            <label className="field">
              Email
              <input
                className="inp"
                type="email"
                autoComplete="username"
                name="email"
                placeholder="you@hotel.com"
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
                  minLength={6}
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
            {error && (
              <p className="alert" role="alert">
                {error}
              </p>
            )}
            <button className="btn" type="submit">
              Войти
              <Icon name="arrow" width={16} />
            </button>
          </form>
          <div className="login-preview">
            <span>{demo ? 'Демонстрационный режим' : 'Авторизация пока не подключена'}</span>
            <Link href="/today">
              {demo ? 'Открыть демо' : 'Открыть рабочее пространство'}
              <Icon name="arrow" width={14} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
