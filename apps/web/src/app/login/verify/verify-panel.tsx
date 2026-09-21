'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Icon } from '../../../components/icon';
import { verifyEmailAction } from '../actions';

/**
 * Подтверждение почты по ссылке из письма. Раньше здесь была кнопка «Подтвердить почту и войти»:
 * человек открывал письмо, попадал сюда и должен был нажать ещё раз. Многие вместо этого шли на
 * «Войти», вводили пароль неподтверждённой почты и упирались в «Почта не подтверждена». Теперь
 * страница подтверждает сама, как только открылась в настоящем браузере: JS выполняется только у
 * человека, а почтовые сканеры ходят по ссылке без него — «подтверждение по открытию» у них раньше
 * человека не сработает (ADR-060). Кнопка остаётся лишь как повтор, если что-то не заладилось.
 */
export function VerifyPanel({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(
    token ? null : 'Ссылка неполная: откройте её из письма целиком',
  );
  const [pending, start] = useTransition();
  const started = useRef(false);

  const confirm = () =>
    start(async () => {
      const result = await verifyEmailAction(token);
      setError(result.error);
    });

  // Один раз при открытии страницы: повторный запуск в строгом режиме отсекает ref, а не токен
  useEffect(() => {
    if (token && !started.current) {
      started.current = true;
      confirm();
    }
  }, []);

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
          <p>Подтверждаем вашу почту — и сразу откроем рабочее место.</p>
        </div>
      </section>
      <section className="login-form-panel">
        <div className="login-form">
          <span className="round-icon">
            <Icon name="shield" />
          </span>
          <h2>Подтверждение почты</h2>
          {error ? (
            <>
              <p className="alert" role="alert">
                {error}
              </p>
              {token && (
                <button className="btn" type="button" disabled={pending} onClick={confirm}>
                  {pending ? 'Подтверждаем…' : 'Подтвердить ещё раз'}
                  <Icon name="arrow" width={16} />
                </button>
              )}
              <div className="login-preview">
                <span>Ссылка не сработала?</span>
                <Link href="/login">Войти и запросить письмо заново</Link>
              </div>
            </>
          ) : (
            <p role="status">Подтверждаем почту и открываем рабочее место…</p>
          )}
        </div>
      </section>
    </main>
  );
}
