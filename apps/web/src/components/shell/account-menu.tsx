import Link from 'next/link';
import { signOut } from '../../app/login/actions';
import { ApiError } from '../../lib/api';
import { currentMe } from '../../lib/desk-shell';
import { currentLocale } from '../../i18n/server';
import { translator } from '../../i18n';
import { Icon } from '../icon';

/**
 * Кто на смене: в меню профиля (DATA_MODEL §13.8, ADR-049). Серверный кусок внутри клиентской шапки:
 * имя приходит от API по токену сессии, а «Выйти» отзывает сессию в базе, а не просто чистит cookie.
 * Пока вход не обязателен (APP_AUTH_REQUIRED не задан), без сессии здесь просто ссылка на экран входа.
 * Выбор языка убран из меню по решению владельца от 25.10.2026.
 */
export async function AccountMenu() {
  const me = await currentMe().catch((error: unknown) => {
    if (error instanceof ApiError) return { user: null };
    throw error;
  });
  const user = me.user ?? null;
  const locale = await currentLocale();
  const t = translator(locale);

  if (!user)
    return (
      <Link href="/login">
        <Icon name="departure" />
        {t('Экран входа')}
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
          {t('Выйти')}
        </button>
      </form>
    </>
  );
}
