'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Icon } from '../../components/icon';
import { useTheme } from '../../components/theme-provider';
import { daysLeft } from '@pms/domain';
import type { AuthInvite, AuthSession, AuthSessionRow } from '../../lib/api';
import {
  inviteAction,
  logoutAction,
  logoutAllAction,
  registerAction,
  requestCodeAction,
  verifyAction,
} from './actions';
import { displayDate } from '../../lib/display-date';

export type LoginMode = 'login' | 'register';

export function LoginForm({
  demo,
  accessEmail,
  session,
  mode: initialMode = 'login',
  invites = [],
  sessions = [],
  initialEmail = '',
  initialStep = 'email',
}: {
  demo: boolean;
  accessEmail: string | null;
  /** Своя сессия WETOP (срез 13). Имеет приоритет над Cloudflare Access: два входа сосуществуют. */
  session: AuthSession | null;
  mode?: LoginMode;
  /** Ожидающие приглашения своей организации (этап 7) — показываются только вошедшему. */
  invites?: AuthInvite[];
  /** «Где я вошёл» (§13.5): живые сессии вошедшего, устройство словами, своя помечена. */
  sessions?: AuthSessionRow[];
  /** После принятия приглашения форма открывается сразу на шаге кода с известной почтой. */
  initialEmail?: string;
  initialStep?: 'email' | 'code';
}) {
  const [mode, setMode] = useState<LoginMode>(initialMode);
  const [step, setStep] = useState<'email' | 'code'>(initialStep);
  const [email, setEmail] = useState(initialEmail);
  const [organizationName, setOrganizationName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const { setTheme } = useTheme();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [invited, setInvited] = useState<string[]>([]);

  /** Приглашение по почте: строка «отправлено» добавляется к списку без перезагрузки страницы. */
  function submitInvite() {
    setInviteError('');
    startTransition(async () => {
      const r = await inviteAction(inviteEmail);
      if (r.error) setInviteError(r.error);
      else {
        setInvited((list) => [r.email!, ...list]);
        setInviteEmail('');
      }
    });
  }

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
          <span className="eyebrow">Стойка, брони и каналы в одном окне</span>
          <h1>
            Весь объект
            <br />
            под контролем.
          </h1>
          <p>
            Брони. Гости. Оплаты. Номера.
            <br />В одной системе.
          </p>
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
          {session ? (
            <>
              <h2>Вы вошли</h2>
              <p>
                как <b>{session.email}</b>
                <br />
                {session.organizationName}
                {session.organizationStatus === 'TRIAL' && session.trialEndsAt && (
                  <>
                    <br />
                    <span className="muted">
                      {daysLeft(new Date(session.trialEndsAt), new Date()) === 0
                        ? 'Пробный период закончился'
                        : `Пробный период: ещё ${daysLeft(new Date(session.trialEndsAt), new Date())} дн.`}
                    </span>
                  </>
                )}
              </p>
              <Link className="btn" href="/today">
                Открыть рабочее место
                <Icon name="arrow" width={16} />
              </Link>
              <div className="login-preview">
                <span>Вход по коду на почту</span>
                <form action={logoutAction}>
                  <button type="submit" className="btn btn--secondary">
                    Выйти
                  </button>
                </form>
              </div>
              {/* Приглашения (срез 13, этап 7): ролей нет — каждый вошедший зовёт в свою организацию */}
              <section className="login-invites" aria-labelledby="invite-heading">
                <h3 id="invite-heading">Пригласить администратора</h3>
                <p className="muted">
                  На почту придёт ссылка на 7 дней. Человек примет её и войдёт по коду, как все.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitInvite();
                  }}
                >
                  <label className="field">
                    Почта приглашённого
                    <input
                      className="inp"
                      type="email"
                      name="inviteEmail"
                      autoComplete="off"
                      placeholder="admin@hotel.com"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </label>
                  {inviteError && (
                    <p className="alert" role="alert">
                      {inviteError}
                    </p>
                  )}
                  <button className="btn btn--secondary" type="submit" disabled={pending}>
                    Отправить приглашение
                  </button>
                </form>
                {invited.length + invites.length > 0 ? (
                  <ul className="login-invite-list" data-testid="invite-list">
                    {invited.map((e) => (
                      <li key={`new-${e}`}>
                        <b>{e}</b> <span className="muted">приглашение отправлено</span>
                      </li>
                    ))}
                    {invites
                      .filter((i) => !invited.includes(i.email))
                      .map((i) => (
                        <li key={i.id}>
                          <b>{i.email}</b>{' '}
                          <span className="muted">
                            ждёт ответа до{' '}
                            <time dateTime={i.expiresAt}>
                              {displayDate(i.expiresAt.slice(0, 10))}
                            </time>
                          </span>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="muted" data-testid="invite-empty">
                    Ожидающих приглашений нет.
                  </p>
                )}
              </section>
              {/* «Где я вошёл» и «выйти везде» (§13.5): отзыв гасит все ключи человека, включая этот */}
              <section className="login-invites" aria-labelledby="sessions-heading">
                <h3 id="sessions-heading">Где вы вошли</h3>
                {sessions.length > 0 ? (
                  <ul className="login-invite-list" data-testid="session-list">
                    {sessions.map((s) => (
                      <li key={s.id}>
                        <b>{s.device}</b>{' '}
                        <span className="muted">
                          вход{' '}
                          <time dateTime={s.issuedAt}>{displayDate(s.issuedAt.slice(0, 10))}</time>
                          {s.current ? ', этот сеанс' : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Список сеансов недоступен.</p>
                )}
                <form action={logoutAllAction}>
                  <button type="submit" className="btn btn--secondary">
                    Завершить все сеансы
                  </button>
                </form>
              </section>
            </>
          ) : accessEmail ? (
            <>
              <h2>Вы вошли</h2>
              <p>
                как <b>{accessEmail}</b>
              </p>
              <Link className="btn" href="/today">
                Открыть рабочее место
                <Icon name="arrow" width={16} />
              </Link>
              <div className="login-preview">
                <span>Вход защищён Cloudflare Access</span>
                {/* путь Cloudflare, не маршрут приложения: обычная ссылка, не next/link */}
                <a href="/cdn-cgi/access/logout">Выйти</a>
              </div>
            </>
          ) : step === 'code' ? (
            <>
              <h2>Код отправлен</h2>
              <p>
                Если адрес <b>{email}</b> нам знаком, письмо с кодом уже идёт. Код действует 10
                минут.
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
                <button className="btn" type="submit" disabled={pending}>
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
                <button className="btn" type="submit" disabled={pending}>
                  {mode === 'register' ? 'Создать организацию' : 'Получить код'}
                  <Icon name="arrow" width={16} />
                </button>
              </form>
              <div className="login-preview">
                <span>
                  {mode === 'register' ? 'Уже есть организация?' : 'Ещё нет организации?'}
                </span>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => {
                    setError('');
                    setMode(mode === 'register' ? 'login' : 'register');
                  }}
                >
                  {mode === 'register' ? 'Войти по коду' : 'Попробовать бесплатно'}
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
