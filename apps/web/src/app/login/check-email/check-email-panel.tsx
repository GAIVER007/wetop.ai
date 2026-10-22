'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { AuthShell } from '../../../components/auth-shell';
import { Icon } from '../../../components/icon';
import { resendVerification, type ResendState } from '../actions';
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
            {email ? `Письмо со ссылкой отправлено на ${email}.` : 'Письмо со ссылкой отправлено.'}{' '}
            Откройте его и нажмите «Подтвердить почту» — после этого вход откроется. Ссылка работает
            72 часа и только один раз.
          </p>
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
