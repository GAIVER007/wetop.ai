'use client';
import type React from 'react';
import Link from 'next/link';
import { useActionState, useState, useTransition } from 'react';
import { AuthShell } from '../../../components/auth-shell';
import { Icon } from '../../../components/icon';
import { resendVerification, verifyEmailCodeAction, type ResendState } from '../actions';
import { Input } from '../../../components/ui';

/**
 * Что человек видит после «Создать»: письмо ушло, вход откроется по ссылке из него.
 * Кнопка «выслать заново» отвечает одинаково для любой почты — по ответу нельзя проверить чужой адрес.
 */
export function CheckEmailPanel({ email, sent }: { email: string; sent: boolean }) {
  const [state, submit, pending] = useActionState<ResendState, FormData>(resendVerification, {
    error: null,
    sent: false,
  });
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();
  // Код из письма (22.10.2026): шесть цифр и вход сразу; ссылка из того же письма остаётся запасным путём
  const confirmCode = (event: React.FormEvent) => {
    event.preventDefault();
    startCheck(async () => {
      const result = await verifyEmailCodeAction(email, code);
      setCodeError(result.error);
      if (result.redirectTo) window.location.assign(result.redirectTo);
    });
  };
  return (
    <AuthShell
      story={{
        eyebrow: 'Остался один шаг',
        title: (
          <>
            Подтвердите <br /> вашу почту.
          </>
        ),
        text: 'Так мы знаем, что адрес ваш: по нему же вы будете возвращать пароль.',
      }}
    >
      <span className="round-icon">
        <Icon name="shield" />
      </span>
      {sent ? (
        <>
          <h2>Проверьте почту</h2>
          <p>
            {email ? `Код из 6 цифр отправлен на ${email}.` : 'Код из 6 цифр отправлен на вашу почту.'}{' '}
            Введите его ниже: вход откроется сразу. Код действует 15 минут. В том же письме есть
            ссылка: она работает 72 часа, если удобнее подтвердить по ней.
          </p>
          {email ? (
            <form onSubmit={confirmCode}>
              <label className="field">
                Код из письма
                <Input
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9 ]{6,7}"
                  maxLength={7}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ''))}
                  required
                />
              </label>
              {codeError && (
                <p className="alert" role="alert">
                  {codeError}
                </p>
              )}
              <button className="btn" type="submit" disabled={checking || code.replace(/\D/g, '').length !== 6}>
                {checking ? 'Проверяем…' : 'Подтвердить и войти'}
                <Icon name="arrow" width={16} />
              </button>
            </form>
          ) : null}
        </>
      ) : (
        <>
          <h2>Учётная запись заведена</h2>
          <p>
            Письмо отправить не удалось: отправка писем на этом объекте не настроена. Обратитесь к
            владельцу объекта — он откроет вход.
          </p>
        </>
      )}
      {state.sent ? (
        <p className="alert" role="status">
          Если такая почта есть в системе и ещё не подтверждена, письмо отправлено заново.
        </p>
      ) : (
        <form action={submit}>
          {email ? (
            <input type="hidden" name="email" value={email} />
          ) : (
            // Сюда же ведёт ссылка с экрана входа, где адреса в строке нет — тогда спрашиваем
            <label className="field">
              Email
              <Input
                type="email"
                name="email"
                autoComplete="username"
                placeholder="you@hotel.com"
                required
              />
            </label>
          )}
          {state.error && (
            <p className="alert" role="alert">
              {state.error}
            </p>
          )}
          <button className="btn" type="submit" disabled={pending}>
            {pending ? 'Отправляем…' : 'Выслать письмо заново'}
            <Icon name="arrow" width={16} />
          </button>
        </form>
      )}
      <div className="login-preview">
        <span>Уже подтвердили?</span>
        <Link href="/login">Войти</Link>
      </div>
    </AuthShell>
  );
}
