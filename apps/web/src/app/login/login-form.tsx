'use client';
import Link from 'next/link';
import { useActionState, useState, useTransition } from 'react';
import { daysLeft } from '@pms/domain';
import { Icon } from '../../components/icon';
import { useTheme } from '../../components/theme-provider';
import type { SignedIn } from '../../lib/api';
import {
  registerAction,
  requestCodeAction,
  signIn,
  signOut,
  verifyAction,
  type LoginState,
} from './actions';

/**
 * Способ входа. Пока владелец не выбрал один (Q-146), на экране живут оба: по паролю (ADR-049) —
 * по умолчанию, и по коду на почту (ADR-046); регистрация — тот же код, но сначала организация.
 */
export type LoginMode = 'password' | 'code' | 'register';

export function LoginForm({
  demo,
  accessEmail,
  user,
  passwordJustSet = false,
  mode: initialMode = 'password',
}: {
  demo: boolean;
  accessEmail: string | null;
  /** Своя сессия WETOP любым из двух входов. Имеет приоритет над Cloudflare Access: два замка сосуществуют. */
  user: SignedIn | null;
  passwordJustSet?: boolean;
  mode?: LoginMode;
}) {
  const [mode, setMode] = useState<LoginMode>(initialMode);
  const [show, setShow] = useState(false);
  const [state, submit, pending] = useActionState<LoginState, FormData>(signIn, { error: null });

  // вход по коду: почта (и название организации) → код из письма
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(accessEmail ?? '');
  const [organizationName, setOrganizationName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [codePending, startTransition] = useTransition();
  const { setTheme } = useTheme();

  const switchTo = (next: LoginMode) => {
    setError('');
    setMode(next);
  };

  /** Первый шаг: почта (и название организации при регистрации). Дальше — ввод кода из письма. */
  function submitEmail() {
    setError('');
    startTransition(async () => {
      const r =
        mode === 'register'
          ? await registerAction(email, organizationName)
          : await requestCodeAction(email);
      if (r.error) setError(r.error);
      else setStep('code');
    });
  }

  /** Второй шаг: код. При удаче действие само уводит на рабочее место. */
  function submitCode() {
    setError('');
    startTransition(async () => {
      const r = await verifyAction(email, code);
      if (r.error) setError(r.error);
    });
  }

  const trialLine = (u: SignedIn) => {
    const org = u.organization;
    if (!org || org.status !== 'TRIAL' || !org.trialEndsAt) return null;
    const left = daysLeft(new Date(org.trialEndsAt), new Date());
    return left === 0 ? 'Пробный период закончился' : `Пробный период: ещё ${left} дн.`;
  };

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
                как <b>{user.name ?? user.email}</b>
                {user.name ? ` · ${user.email}` : ''}
                {user.organization && (
                  <>
                    <br />
                    {user.organization.name}
                    {trialLine(user) && (
                      <>
                        <br />
                        <span className="muted">{trialLine(user)}</span>
                      </>
                    )}
                  </>
                )}
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
          ) : step === 'code' ? (
            <>
              <h2>Код отправлен</h2>
              <p>
                Если адрес <b>{email}</b> нам знаком, письмо с кодом уже идёт. Код действует 10 минут.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitCode();
                }}
              >
                <label className="field">
                  Код из письма
                  <input
                    className="inp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    name="code"
                    pattern="\d{6}"
                    maxLength={6}
                    placeholder="000000"
                    required
                    autoFocus
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  />
                </label>
                {error && (
                  <p className="alert" role="alert">
                    {error}
                  </p>
                )}
                <button className="btn" type="submit" disabled={codePending}>
                  Войти
                  <Icon name="arrow" width={16} />
                </button>
              </form>
              <div className="login-preview">
                <span>Письмо не пришло? Проверьте «Спам» или запросите код заново.</span>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => {
                    setCode('');
                    setError('');
                    setStep('email');
                  }}
                >
                  Другая почта или новый код
                </button>
              </div>
            </>
          ) : mode === 'password' ? (
            <>
              <h2>Добро пожаловать</h2>
              <p>Войдите в рабочее пространство</p>
              {passwordJustSet && (
                <p className="alert alert--ok" role="status">
                  Пароль сохранён. Войдите с ним.
                </p>
              )}
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
              <Link className="login-forgot" href="/login/reset">
                Забыли пароль?
              </Link>
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
              <div className="login-preview">
                <span>Другой способ входа</span>
                <button type="button" className="btn btn--secondary" onClick={() => switchTo('code')}>
                  Войти по коду из письма
                </button>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => switchTo('register')}
                >
                  Попробовать бесплатно
                </button>
              </div>
            </>
          ) : (
            <>
              <h2>{mode === 'register' ? 'Попробовать бесплатно' : 'Добро пожаловать'}</h2>
              <p>
                {mode === 'register'
                  ? 'Семь дней пробного периода. Пароль не нужен: код для входа придёт на почту.'
                  : 'Войдите по коду из письма'}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitEmail();
                }}
              >
                {mode === 'register' && (
                  <label className="field">
                    Название организации
                    <input
                      className="inp"
                      type="text"
                      autoComplete="organization"
                      name="organizationName"
                      placeholder="Хостел «Пример»"
                      required
                      maxLength={200}
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                    />
                  </label>
                )}
                <label className="field">
                  Email
                  <input
                    className="inp"
                    type="email"
                    autoComplete="username"
                    name="email"
                    placeholder="you@hotel.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                {error && (
                  <p className="alert" role="alert">
                    {error}
                  </p>
                )}
                <button className="btn" type="submit" disabled={codePending}>
                  {mode === 'register' ? 'Создать организацию' : 'Получить код'}
                  <Icon name="arrow" width={16} />
                </button>
              </form>
              <div className="login-preview">
                <span>{mode === 'register' ? 'Уже есть организация?' : 'Ещё нет организации?'}</span>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => switchTo(mode === 'register' ? 'code' : 'register')}
                >
                  {mode === 'register' ? 'Войти по коду' : 'Попробовать бесплатно'}
                </button>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => switchTo('password')}
                >
                  Войти по паролю
                </button>
                {demo && (
                  <>
                    <span>Демонстрационный режим</span>
                    <Link href="/today">
                      Открыть демо
                      <Icon name="arrow" width={14} />
                    </Link>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
