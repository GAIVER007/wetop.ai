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
  type LoginState,
} from './actions';
import { displayDate } from '../../lib/display-date';
import './login.css';

/**
 * Что показывает экран: вход по паролю (ADR-049, ADR-053 — владелец выбрал его 20.09.2026) или
 * регистрацию новой организации — почта, имя, пароль, а следом письмо с подтверждением (ADR-060).
 *
 * Входа по коду на почту больше нет нигде: 20.09.2026 он снят с экрана, а 20.09 же приглашения
 * переведены на пароль — принявший ссылку задаёт себе пароль сам. Код удалён целиком (ADR-053).
 */
export type LoginMode = 'password' | 'register';

export function LoginForm({
  demo,
  user,
  passwordJustSet = false,
  mode: initialMode = 'password',
  registrationEnabled = false,
  invites = [],
  sessions = [],
  initialEmail = '',
}: {
  demo: boolean;
  /** Своя сессия WETOP. Cloudflare Access снят 20.09.2026 — замок остался один (ADR-053). */
  user: SignedIn | null;
  passwordJustSet?: boolean;
  mode?: LoginMode;
  /** Серверное состояние API. До получения настройки форму регистрации не показываем. */
  registrationEnabled?: boolean;
  /** Ожидающие приглашения своей организации (этап 7) — показываются только вошедшему. */
  invites?: AuthInvite[];
  /** «Где я вошёл» (§13.5): живые сессии вошедшего, устройство словами, своя помечена. */
  sessions?: AuthSessionRow[];
  /** Почта, подставленная в поле: приходит из ссылки (`?email=`). Заголовок Access не читается — Access снят (ADR-053) */
  initialEmail?: string;
}) {
  const [requestedMode, setMode] = useState<LoginMode>(initialMode);
  const mode = registrationEnabled ? requestedMode : 'password';
  const [show, setShow] = useState(false);
  const [state, submit, pending] = useActionState<LoginState, FormData>(signIn, { error: null });

  const [email, setEmail] = useState(initialEmail);
  const [personName, setPersonName] = useState('');
  const [hotelName, setHotelName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [registerPending, startTransition] = useTransition();
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
   * Регистрация: почта, имя, название отеля, пароль. При удаче действие уводит на экран «подтвердите
   * почту» — сессия откроется только после перехода по ссылке из письма (ADR-060).
   */
  function submitRegister() {
    setError('');
    startTransition(async () => {
      const r = await registerAction(email, personName, hotelName, password);
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
              {/* Приглашения (срез 13, этап 7): зовёт владелец организации (ADR-083); сотруднику — кто это делает */}
              {user.role === 'STAFF' ? (
                <section className="login-invites" aria-labelledby="invite-heading">
                  <h3 id="invite-heading">Пригласить администратора</h3>
                  <p className="muted" data-testid="invite-owner-only">
                    Приглашать сотрудников может только владелец организации.
                  </p>
                </section>
              ) : (
                <section className="login-invites" aria-labelledby="invite-heading">
                  <h3 id="invite-heading">Пригласить администратора</h3>
                  <p className="muted">
                    Ссылка действует 7 дней. По ней сотрудник присоединится к вашей организации.
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
                    <button className="btn btn--secondary" type="submit" disabled={registerPending}>
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
              )}
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
              {/* Вход отвечает так, когда почта не подтверждена: ведём туда, где письмо высылают заново */}
              {state.error?.includes('Почта не подтверждена') && (
                <Link className="login-forgot" href="/login/check-email">
                  Выслать письмо с подтверждением заново
                </Link>
              )}
              <Link className="login-forgot" href="/login/reset">
                Забыли пароль?
              </Link>
              <div className="login-preview">
                {!registrationEnabled && initialMode === 'register' ? (
                  <span role="status">
                    Самостоятельная регистрация временно закрыта. Доступ сотрудникам выдаёт
                    администратор объекта.
                  </span>
                ) : (
                  <span>
                    {demo
                      ? 'Демонстрационный режим'
                      : 'Нет доступа? Обратитесь к владельцу или администратору объекта.'}
                  </span>
                )}
              </div>
              {registrationEnabled && (
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
              )}
            </>
          ) : (
            <>
              <h1>Регистрация</h1>
              <p>
                Семь дней пробного периода. Пришлём письмо на указанную почту: подтвердите её — и
                дальше входите этой же парой почта-пароль.
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
                  Название отеля
                  <input
                    className="inp"
                    type="text"
                    autoComplete="organization"
                    name="hotelName"
                    placeholder="Так его увидят на стойке и в отчётах"
                    required
                    maxLength={200}
                    value={hotelName}
                    onChange={(e) => setHotelName(e.target.value)}
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
                      disabled={registerPending}
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
                  disabled={registerPending}
                  aria-busy={registerPending}
                >
                  {registerPending ? 'Создаём…' : 'Создать организацию'}
                  <Icon name="arrow" width={16} />
                </button>
              </form>
              <div className="login-preview">
                <span>Уже есть учётная запись?</span>
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={registerPending}
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
