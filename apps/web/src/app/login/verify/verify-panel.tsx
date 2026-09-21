'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Icon } from '../../../components/icon';
import { verifyEmailAction } from '../actions';

/** Кнопка «Подтвердить почту и войти». Удача уводит на рабочее место, отказ остаётся текстом здесь. */
export function VerifyPanel({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(
    token ? null : 'Ссылка неполная: откройте её из письма целиком',
  );
  const [pending, start] = useTransition();

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
          <span className="eyebrow">Подтверждение почты</span>
          <h1>
            Почти
            <br />
            готово.
          </h1>
          <p>Нажмите кнопку — и сразу окажетесь на рабочем месте.</p>
        </div>
      </section>
      <section className="login-form-panel">
        <div className="login-form">
          <span className="round-icon">
            <Icon name="shield" />
          </span>
          <h2>Подтвердить почту</h2>
          <p>Пароль спрашивать не будем: вы задали его при регистрации.</p>
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          <button
            className="btn"
            type="button"
            disabled={pending || !token}
            onClick={() =>
              start(async () => {
                const result = await verifyEmailAction(token);
                setError(result.error);
              })
            }
          >
            {pending ? 'Подтверждаем…' : 'Подтвердить почту и войти'}
            <Icon name="arrow" width={16} />
          </button>
          <div className="login-preview">
            <span>Ссылка не сработала?</span>
            <Link href="/login">Войти и запросить письмо заново</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
