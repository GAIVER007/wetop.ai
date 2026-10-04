'use client';

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  BUSINESS_VERTICALS,
  parseBusinessVertical,
  verticalDefinition,
  type BusinessVertical,
} from '../../../../packages/domain/src/verticals/registry';
import type { Dictionary } from '../i18n/types';
import type { AuthMode } from '../lib/site';
import { PHONE_COUNTRIES, PRIVACY_POLICY_PATH, defaultPhoneCountry } from '../lib/phone-countries';

type Texts = Dictionary['auth'];

type Props = {
  texts: Texts;
  /** Адреса стойки — считает сервер сборки (`lib/site.ts`), клиенту настройки не нужны. */
  urls: {
    login: string;
    register: string;
    reset: string;
    app: string;
    endpoint: Record<'options' | 'login' | 'register' | 'resend' | 'session', string>;
  };
};

type Registration = 'unknown' | 'open' | 'closed';
type Sent = { email: string; sent: boolean };

/** Ответ стойки: `{ message }` при ошибке. Сбой сети — `null`: окно предложит отдельную страницу. */
async function post(
  url: string,
  body: unknown,
): Promise<{ ok: boolean; data: Record<string, unknown> } | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, data };
  } catch {
    return null;
  }
}

function message(data: Record<string, unknown>, fallback: string): string {
  return typeof data.message === 'string' && data.message ? data.message : fallback;
}

/** Путь от стойки — только от корня; иначе Главная стойки (то же правило, что `appPath` в `lib/site.ts`). */
function nextUrl(app: string, next: unknown): string {
  const path = typeof next === 'string' && /^\/(?!\/)[\w\-./?=&%]*$/.test(next) ? next : '/today';
  return `${app}${path}`;
}

const RESEND_PAUSE_S = 60;

/*
 * Окно входа и создания аккаунта поверх главной (ADR-100, plans/site-auth-dialog-tour-2026-09-27.md).
 *
 * Кнопки ведут на главную; для браузера без JavaScript в layout есть техническая резервная форма.
 * Здесь ссылки с `data-auth` перехватываются и открывают окно; `#login` и `#register` в адресе — тоже.
 * Запрос уходит на стойку (`/api/site-auth/*`), куку сессии ставит она; после входа браузер переходит в стойку.
 */
export function AuthDialog({ texts, urls }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [vertical, setVertical] = useState<BusinessVertical>('HOSPITALITY');
  const [mode, setMode] = useState<AuthMode>('login');
  const [isOpen, setIsOpen] = useState(false);
  const [registration, setRegistration] = useState<Registration>('unknown');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ text: string; fallback: boolean } | null>(null);
  const [done, setDone] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);
  const [resent, setResent] = useState(false);
  const [pause, setPause] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordJustSet, setPasswordJustSet] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    hotelName: '',
    phoneCountry: 'KZ',
    phone: '',
  });
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  // Страна кода телефона — по браузеру (29.09.2026), после появления на экране: статичная сборка браузера не знает
  useEffect(() => {
    const country = defaultPhoneCountry(
      navigator.languages ?? [],
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
    const query = new URLSearchParams(window.location.search);
    setForm((f) => ({ ...f, phoneCountry: country, email: query.get('email') ?? '' }));
    setVertical(parseBusinessVertical(query.get('vertical')) ?? 'HOSPITALITY');
    setPasswordJustSet(query.get('password') === 'set');
  }, []);
  const optionsAsked = useRef(false);
  const passwordId = useId();

  const open = useCallback(
    (next: AuthMode) => {
      setMode(next);
      setError(null);
      setIsOpen(true);
      if (!optionsAsked.current) {
        optionsAsked.current = true;
        fetch(urls.endpoint.options, { credentials: 'include' })
          .then((res) => (res.ok ? res.json() : null))
          .then((data: { registrationEnabled?: boolean } | null) =>
            setRegistration(data ? (data.registrationEnabled ? 'open' : 'closed') : 'unknown'),
          )
          .catch(() => setRegistration('unknown'));
      }
    },
    [urls.endpoint.options],
  );

  // Открываем после commit: режим и начальные поля уже отрисованы, ввод не потеряется при гидратации.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (isOpen && dialog && !dialog.open) dialog.showModal();
  }, [isOpen]);

  // Ссылки с data-auth по всей странице и #login / #register в адресе
  useEffect(() => {
    const fromHash = () => {
      const hash = window.location.hash;
      if (hash === '#login' || hash === '#register') open(hash === '#login' ? 'login' : 'register');
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; // новая вкладка — как обычная ссылка
      const link = (event.target as Element | null)?.closest?.('a[data-auth]');
      if (!link) return;
      const target = link.getAttribute('data-auth');
      if (target !== 'login' && target !== 'register') return;
      event.preventDefault();
      if (target === 'register') {
        const choice = parseBusinessVertical(
          new URL((link as HTMLAnchorElement).href).searchParams.get('vertical'),
        );
        if (choice) setVertical(choice);
      }
      open(target);
    };
    fromHash();
    document.addEventListener('click', onClick);
    window.addEventListener('hashchange', fromHash);
    return () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener('hashchange', fromHash);
    };
  }, [open]);

  // Пауза перед повторным письмом — секунды словами на кнопке
  useEffect(() => {
    if (pause <= 0) return;
    const id = window.setTimeout(() => setPause((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [pause]);

  const close = () => dialogRef.current?.close();
  const onClose = () => {
    setIsOpen(false);
    const hash = window.location.hash;
    if (hash === '#login' || hash === '#register') {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  };

  const switchTo = (next: AuthMode) => {
    setMode(next);
    setError(null);
  };

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => {
    const value = event.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.email.trim() || !form.password)
      return setError({ text: texts.errors.required, fallback: false });
    setPending(true);
    setError(null);
    const next = new URLSearchParams(window.location.search).get('next') ?? '/today';
    const res = await post(urls.endpoint.login, {
      email: form.email.trim(),
      password: form.password,
      next,
    });
    if (res?.ok) {
      try {
        const check = await fetch(urls.endpoint.session, {
          credentials: 'include',
          cache: 'no-store',
          signal: AbortSignal.timeout(15_000),
        });
        if (!check.ok) throw new Error('session unavailable');
        const session = await check.json();
        if (session.authenticated !== true) {
          setPending(false);
          return setError({
            text: 'Браузер не сохранил сессию. Разрешите cookies для WETOP или откройте резервную форму входа.',
            fallback: true,
          });
        }
      } catch {
        setPending(false);
        return setError({
          text: 'Не удалось проверить вход. Проверьте соединение и попробуйте ещё раз.',
          fallback: true,
        });
      }
      setDone(true);
      window.location.assign(nextUrl(urls.app, res.data.next));
      return;
    }
    setPending(false);
    if (!res) return setError({ text: texts.errors.network, fallback: true });
    setError({ text: message(res.data, texts.errors.network), fallback: false });
  };

  const chooseVertical = (id: BusinessVertical) => {
    setVertical(id);
    const url = new URL(window.location.href);
    url.searchParams.set('vertical', id);
    window.history.replaceState(null, '', url);
  };
  const registrationFallback = new URL(urls.register);
  registrationFallback.searchParams.set('vertical', vertical);

  const submitRegister = async (event: FormEvent) => {
    event.preventDefault();
    const body = {
      email: form.email.trim(),
      name: form.name.trim(),
      vertical,
      businessName: form.hotelName.trim(),
      password: form.password,
      phoneCountry: form.phoneCountry,
      phone: form.phone.trim(),
      privacyAccepted,
    };
    if (!body.email || !body.name || !body.businessName || !body.password || !body.phone) {
      return setError({ text: texts.errors.required, fallback: false });
    }
    if (!privacyAccepted) return setError({ text: texts.errors.privacy, fallback: false });
    setPending(true);
    setError(null);
    const res = await post(urls.endpoint.register, body);
    setPending(false);
    if (!res) return setError({ text: texts.errors.network, fallback: true });
    if (!res.ok)
      return setError({ text: message(res.data, texts.errors.network), fallback: false });
    setSent({
      email: typeof res.data.email === 'string' ? res.data.email : body.email,
      sent: res.data.sent !== false,
    });
    setResent(false);
    setPause(RESEND_PAUSE_S);
  };

  const resend = async () => {
    if (!sent || pause > 0) return;
    setPending(true);
    setError(null);
    const res = await post(urls.endpoint.resend, { email: sent.email });
    setPending(false);
    if (!res) return setError({ text: texts.errors.network, fallback: true });
    if (!res.ok)
      return setError({ text: message(res.data, texts.errors.network), fallback: false });
    setResent(true);
    setPause(RESEND_PAUSE_S);
  };

  const errorBlock = error && (
    <div className="auth-dialog__alert" role="alert">
      <span>{error.text}</span>
      {error.fallback ? (
        <a href={mode === 'login' ? urls.login : registrationFallback.toString()}>
          {texts.errors.fallback}
        </a>
      ) : null}
      {mode === 'login' && error.text.includes('Почта не подтверждена') && (
        <button
          type="button"
          onClick={() => {
            setSent({ email: form.email.trim(), sent: false });
            setPause(0);
            setResent(false);
            setError(null);
          }}
        >
          Запросить письмо подтверждения
        </button>
      )}
    </div>
  );

  const passwordField = (autoComplete: 'current-password' | 'new-password') => (
    // Подпись связана с полем через id: кнопка «Показать» внутри <label> вошла бы в имя поля
    <div className="auth-field">
      <label className="auth-field__label" htmlFor={passwordId}>
        {texts.fields.password}
      </label>
      <span className="auth-field__password">
        <input
          id={passwordId}
          className="auth-field__input"
          type={showPassword ? 'text' : 'password'}
          name="password"
          autoComplete={autoComplete}
          required
          minLength={autoComplete === 'new-password' ? 10 : undefined}
          placeholder={
            autoComplete === 'new-password'
              ? texts.fields.newPasswordPlaceholder
              : texts.fields.passwordPlaceholder
          }
          value={form.password}
          onChange={set('password')}
          disabled={pending || done}
        />
        <button
          type="button"
          className="auth-field__toggle"
          aria-label={showPassword ? texts.fields.hideLabel : texts.fields.showLabel}
          aria-pressed={showPassword}
          onClick={() => setShowPassword((v) => !v)}
        >
          {showPassword ? texts.fields.hide : texts.fields.show}
        </button>
      </span>
    </div>
  );

  const emailField = (
    <label className="auth-field">
      <span className="auth-field__label">{texts.fields.email}</span>
      <input
        className="auth-field__input"
        type="email"
        name="email"
        autoComplete="username"
        inputMode="email"
        // Окно открылось — курсор сразу в почте (вход) или в имени (регистрация)
        autoFocus={mode === 'login'}
        required
        placeholder={texts.fields.emailPlaceholder}
        value={form.email}
        onChange={set('email')}
        disabled={pending || done}
      />
    </label>
  );

  return (
    <dialog
      ref={dialogRef}
      className="auth-dialog"
      aria-label={texts.dialogLabel}
      onClose={onClose}
      onClick={(event) => {
        // Щелчок по подложке (сам <dialog> за пределами панели) закрывает окно
        if (event.target === dialogRef.current) close();
      }}
    >
      <div className="auth-dialog__panel">
        <button
          type="button"
          className="auth-dialog__close"
          aria-label={texts.close}
          onClick={close}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>

        {sent ? (
          <div className="auth-dialog__body" data-testid="auth-sent">
            <span className="auth-dialog__icon" aria-hidden="true">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
            </span>
            <h2 className="auth-dialog__title">{texts.sent.title}</h2>
            {sent.sent ? (
              <>
                <p className="auth-dialog__lead">
                  {texts.sent.text.replace('{email}', sent.email)}
                </p>
                <p className="auth-dialog__lead">{texts.sent.next}</p>
              </>
            ) : (
              <p className="auth-dialog__lead">{texts.sent.notSent}</p>
            )}
            {resent ? (
              <p className="auth-dialog__status" role="status">
                {texts.sent.resent}
              </p>
            ) : null}
            {errorBlock}
            <div className="auth-dialog__actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={resend}
                disabled={pending || pause > 0}
                aria-busy={pending}
              >
                {pending
                  ? texts.sent.resendPending
                  : pause > 0
                    ? texts.sent.wait.replace('{seconds}', String(pause))
                    : texts.sent.resend}
              </button>
              <button
                type="button"
                className="auth-dialog__link"
                onClick={() => {
                  setSent(null);
                  setError(null);
                  setResent(false);
                }}
              >
                {texts.sent.change}
              </button>
            </div>
          </div>
        ) : (
          <div className="auth-dialog__body">
            <div className="auth-tabs" role="tablist" aria-label={texts.dialogLabel}>
              {(['login', 'register'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  id={`auth-tab-${tab}`}
                  aria-selected={mode === tab}
                  aria-controls="auth-tabpanel"
                  className="auth-tabs__tab"
                  onClick={() => switchTo(tab)}
                >
                  {texts.tabs[tab]}
                </button>
              ))}
            </div>

            <div id="auth-tabpanel" role="tabpanel" aria-labelledby={`auth-tab-${mode}`}>
              {mode === 'login' ? (
                <form className="auth-form" onSubmit={submitLogin} noValidate>
                  <h2 className="auth-dialog__title">{texts.login.title}</h2>
                  <p className="auth-dialog__lead">{texts.login.lead}</p>
                  {passwordJustSet && (
                    <p role="status">Пароль сохранён. Войдите с новым паролем.</p>
                  )}
                  {emailField}
                  {passwordField('current-password')}
                  {errorBlock}
                  {done ? (
                    <p className="auth-dialog__status" role="status">
                      {texts.signedIn}
                    </p>
                  ) : null}
                  <button
                    className="btn btn--primary auth-form__submit"
                    type="submit"
                    disabled={pending || done}
                    aria-busy={pending}
                  >
                    {pending || done ? texts.login.pending : texts.login.submit}
                  </button>
                  <div className="auth-form__foot">
                    <a href={urls.reset}>{texts.login.forgot}</a>
                    <span>
                      {texts.login.noAccount}{' '}
                      <button
                        type="button"
                        className="auth-dialog__link"
                        onClick={() => switchTo('register')}
                      >
                        {texts.tabs.register}
                      </button>
                    </span>
                  </div>
                </form>
              ) : registration === 'closed' ? (
                <div className="auth-form" data-testid="auth-closed">
                  <h2 className="auth-dialog__title">{texts.closed.title}</h2>
                  <p className="auth-dialog__lead">{texts.closed.text}</p>
                  <a className="btn btn--secondary" href="#start" onClick={close}>
                    {texts.closed.action}
                  </a>
                </div>
              ) : (
                <form className="auth-form" onSubmit={submitRegister} noValidate>
                  <h2 className="auth-dialog__title">{texts.register.title}</h2>
                  <p className="auth-dialog__lead">
                    {vertical === 'HOSPITALITY' ? texts.register.lead : texts.register.pilotLead}
                  </p>
                  <fieldset className="auth-verticals">
                    <legend>Чем вы управляете?</legend>
                    {BUSINESS_VERTICALS.map((id) => (
                      <label className="auth-vertical" key={id}>
                        <input
                          type="radio"
                          name="vertical"
                          value={id}
                          checked={vertical === id}
                          onChange={() => chooseVertical(id)}
                          disabled={pending}
                        />
                        <span>
                          {verticalDefinition(id).label}
                          <small>{id === 'HOSPITALITY' ? 'Доступно' : 'Пилот'}</small>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                  {vertical !== 'HOSPITALITY' && (
                    <p className="auth-form__hint" role="status">
                      Подключение по приглашению
                    </p>
                  )}
                  <label className="auth-field">
                    <span className="auth-field__label">{texts.fields.name}</span>
                    <input
                      className="auth-field__input"
                      type="text"
                      name="name"
                      autoComplete="name"
                      autoFocus
                      required
                      maxLength={200}
                      placeholder={texts.fields.namePlaceholder}
                      value={form.name}
                      onChange={set('name')}
                      disabled={pending}
                    />
                  </label>
                  <label className="auth-field">
                    <span className="auth-field__label">{texts.fields.hotel}</span>
                    <input
                      className="auth-field__input"
                      type="text"
                      name="businessName"
                      autoComplete="organization"
                      required
                      maxLength={200}
                      placeholder={texts.fields.hotelPlaceholder}
                      value={form.hotelName}
                      onChange={set('hotelName')}
                      disabled={pending}
                    />
                  </label>
                  <div className="auth-field">
                    <span className="auth-field__label" id="auth-phone-label">
                      {texts.fields.phone}
                    </span>
                    <span className="auth-phone">
                      <select
                        className="auth-field__input"
                        name="phoneCountry"
                        aria-label={texts.fields.phoneCountry}
                        value={form.phoneCountry}
                        onChange={(e) => setForm((f) => ({ ...f, phoneCountry: e.target.value }))}
                        disabled={pending}
                      >
                        {PHONE_COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name} {c.dial}
                          </option>
                        ))}
                      </select>
                      <input
                        className="auth-field__input"
                        type="tel"
                        inputMode="tel"
                        name="phone"
                        autoComplete="tel-national"
                        aria-labelledby="auth-phone-label"
                        required
                        maxLength={40}
                        placeholder={texts.fields.phonePlaceholder}
                        value={form.phone}
                        onChange={set('phone')}
                        disabled={pending}
                      />
                    </span>
                  </div>
                  {emailField}
                  {passwordField('new-password')}
                  <label className="auth-consent">
                    <input
                      type="checkbox"
                      name="privacyAccepted"
                      checked={privacyAccepted}
                      onChange={(e) => setPrivacyAccepted(e.target.checked)}
                      disabled={pending}
                    />
                    <span>
                      {texts.register.consentBefore}{' '}
                      <a href={PRIVACY_POLICY_PATH} target="_blank" rel="noreferrer">
                        {texts.register.consentLink}
                      </a>{' '}
                      {texts.register.consentAfter}
                    </span>
                  </label>
                  <p className="auth-form__hint">{texts.register.terms}</p>
                  {errorBlock}
                  <button
                    className="btn btn--primary auth-form__submit"
                    type="submit"
                    disabled={pending}
                    aria-busy={pending}
                  >
                    {pending ? texts.register.pending : texts.register.submit}
                  </button>
                  <div className="auth-form__foot">
                    <span>
                      {texts.register.haveAccount}{' '}
                      <button
                        type="button"
                        className="auth-dialog__link"
                        onClick={() => switchTo('login')}
                      >
                        {texts.tabs.login}
                      </button>
                    </span>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
