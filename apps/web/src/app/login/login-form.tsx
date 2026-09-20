'use client';
import Link from 'next/link';
import { useActionState, useState, useTransition } from 'react';
import { daysLeft } from '@pms/domain';
import { Icon } from '../../components/icon';
import { useTheme } from '../../components/theme-provider';
import type { AuthInvite, AuthSessionRow, SignedIn } from '../../lib/api';
import {
  inviteAction,
  logoutAllAction,
  registerAction,
  signIn,
  signOut,
  verifyAction,
  type LoginState,
} from './actions';
import { displayDate } from '../../lib/display-date';
import './login.css';

/**
 * Что показывает экран: вход по паролю (ADR-049, ADR-053 — владелец выбрал его 20.09.2026) или
 * регистрацию новой организации — почта, имя, пароль, без письма.
 *
 * Входа по коду на экране больше нет. Сам код не удалён: по нему всё ещё заходит человек, который
 * только что принял приглашение по ссылке (acceptInviteAction уводит на `?step=code`). Перевести
 * приглашения на пароль — отдельная работа, до неё шаг кода остаётся достижимым только оттуда.
 */
export type LoginMode = 'password' | 'register';

export function LoginForm({
  demo,
  accessEmail,
  user,
  passwordJustSet = false,
  mode: initialMode = 'password',
  invites = [],
  sessions = [],
  initialEmail = '',
  initialStep = 'email',
}: {
  demo: boolean;
  accessEmail: string | null;
  /** Своя сессия WETOP любым из двух входов. Имеет приоритет над Cloudflare Access: два замка сосуществуют. */
  user: SignedIn | null;
  passwordJustSet?: boolean;
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
  const [show, setShow] = useState(false);
  const [state, submit, pending] = useActionState<LoginState, FormData>(signIn, { error: null });

  // шаг кода остаётся только для пришедшего по приглашению; обычный вход и регистрация его не видят
  const [step, setStep] = useState<'email' | 'code'>(initialStep);
  const [email, setEmail] = useState(initialEmail || accessEmail || '');
  const [personName, setPersonName] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [codePending, startTransition] = useTransition();
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

  const switchTo = (next: LoginMode) => {
    setError('');
    setMode(next);
  };

  /**
   * Регистрация: почта, имя, пароль. При удаче действие само ставит куку и уводит на рабочее место —
   * второго шага и письма здесь нет (ADR-053).
   */
  function submitRegister() {
    setError('');
    startTransition(async () => {
      const r = await registerAction(email, personName, password);
      if (r.error) setError(r.error);
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
    <main className="login-page login-page--entry" id="main-content">
      <button
        className="icon-button login-theme"
        aria-label="Переключить тему"
        onClick={() =>
          setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark')
        }
      >
        <Icon name="sun" />
      </button>
      <header className="login-brand">
        <Link className="workspace-brand" href="/login" aria-label="WETOP — вход в систему">
          <span className="workspace-mark">W</span>
          <span className="brand-name">
            WETOP<span>.AI</span>
          </span>
        </Link>
      </header>
      <section className="login-form-panel">
        <div className="login-form">
          <span className="round-icon">
            <Icon name="shield" />
          </span>
          {user ? (
            <>
              <h1>Вы вошли</h1>
              <p>
                как <b>{user.name ?? user.email}</b>
                {user.name ? `, ${user.email}` : ''}
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
                  <button className="btn btn--secondary" type="submit" disabled={codePending}>
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
          ) : step === 'code' ? (
            <>
              <h1>Код отправлен</h1>
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
                <button
                  className="btn"
                  type="submit"
                  disabled={codePending}
                  aria-busy={codePending}
                >
                  {codePending ? 'Входим…' : 'Войти'}
                  <Icon name="arrow" width={16} />
                </button>
              </form>
              <div className="login-preview">
                <span>Письмо не пришло? Проверьте «Спам» или запросите код заново.</span>
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={codePending}
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
              <h1>Вход в WETOP</h1>
              <p>Используйте почту и пароль вашей учётной записи</p>
              {passwordJustSet && (
                <p className="alert alert--ok" role="status">
                  Пароль сохранён. Войдите с ним.
                </p>
              )}
              <form
                action={submit}
                aria-busy={pending}
                aria-describedby={state.error ? 'login-error' : undefined}
              >
                <label className="field">
                  Email
                  <input
                    className="inp"
                    type="email"
                    autoComplete="username"
                    name="email"
                    placeholder="you@hotel.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    readOnly={pending}
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
                      readOnly={pending}
                      required
                      placeholder="Введите пароль"
                    />
                    <button
                      type="button"
                      aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
                      aria-pressed={show}
                      disabled={pending}
                      onClick={() => setShow(!show)}
                    >
                      {show ? 'Скрыть' : 'Показать'}
                    </button>
                  </span>
                </label>
                {state.error && (
                  <p className="alert" role="alert" id="login-error">
                    {state.error}
                  </p>
                )}
                <button className="btn" type="submit" disabled={pending} aria-busy={pending}>
                  {pending ? 'Входим…' : 'Войти'}
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
                  <span>
                    {demo
                      ? 'Демонстрационный режим'
                      : 'Нет доступа? Обратитесь к владельцу или администратору объекта.'}
                  </span>
                )}
              </div>
              <div className="login-preview">
                <span>Ещё нет организации?</span>
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={pending}
                  onClick={() => switchTo('register')}
                >
                  Регистрация
                </button>
              </div>
            </>
          ) : (
            <>
              <h1>Регистрация</h1>
              <p>
                Семь дней пробного периода. Входить будете этой же почтой и паролем — письма и кода
                не нужно.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitRegister();
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label className="field">
                  Имя
                  <input
                    className="inp"
                    type="text"
                    autoComplete="name"
                    name="name"
                    placeholder="Как к вам обращаться"
                    required
                    maxLength={200}
                    value={personName}
                    onChange={(e) => setPersonName(e.target.value)}
                  />
                </label>
                <label className="field">
                  Пароль
                  <span className="password-control">
                    <input
                      className="inp"
                      type={show ? 'text' : 'password'}
                      autoComplete="new-password"
                      name="password"
                      aria-label="Пароль"
                      required
                      minLength={10}
                      placeholder="Не короче 10 знаков"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
                      aria-pressed={show}
                      disabled={codePending}
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
                <button
                  className="btn"
                  type="submit"
                  disabled={codePending}
                  aria-busy={codePending}
                >
                  {codePending ? 'Создаём…' : 'Создать организацию'}
                  <Icon name="arrow" width={16} />
                </button>
              </form>
              <div className="login-preview">
                <span>Уже есть учётная запись?</span>
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={codePending}
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
      <section className="login-story" aria-labelledby="login-story-title">
        <div className="login-message">
          <span className="eyebrow">Рабочее пространство отеля и хостела</span>
          <h2 id="login-story-title">
            Рабочий день —<br />
            под контролем
          </h2>
          <p>Проверяйте заезды и выезды, размещайте гостей и отслеживайте оплаты в WETOP.</p>
          <ul className="login-features">
            <li>
              <Icon name="arrival" />
              <div>
                <strong>Планы на смену</strong>
                <span>Заезды, выезды и задачи, которые требуют внимания.</span>
              </div>
            </li>
            <li>
              <Icon name="board" />
              <div>
                <strong>Размещение на одном экране</strong>
                <span>Номера, койки и брони в наглядной шахматке.</span>
              </div>
            </li>
            <li>
              <Icon name="receipt" />
              <div>
                <strong>Понятные расчёты</strong>
                <span>Начисления, оплаты и остаток по каждой брони.</span>
              </div>
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
