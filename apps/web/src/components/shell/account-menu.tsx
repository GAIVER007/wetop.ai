import Link from 'next/link';
import { signOut } from '../../app/login/actions';
import { ApiError, authApi } from '../../lib/api';
import { Icon } from '../icon';

/**
 * Кто на смене — в меню профиля (DATA_MODEL §13.8, ADR-049). Серверный кусок внутри клиентской шапки:
 * имя приходит от API по токену сессии, а «Выйти» отзывает сессию в базе, а не просто чистит cookie.
 * Пока вход не обязателен (APP_AUTH_REQUIRED не задан), без сессии здесь просто ссылка на экран входа.
 */
export async function AccountMenu() {
  const me = await authApi.me().catch((error: unknown) => {
    if (error instanceof ApiError) return { user: null };
    throw error;
  });
  const user = me.user ?? null;

  if (!user)
    return (
      <Link href="/login">
        <Icon name="departure" />
        Экран входа
      </Link>
    );

  return (
    <>
      <span className="profile-signed-in">
        <strong>{user.name ?? user.email}</strong>
        {user.name && <small>{user.email}</small>}
      </span>
      <form action={signOut}>
        <button type="submit">
          <Icon name="departure" />
          Выйти
        </button>
      </form>
    </>
  );
}
