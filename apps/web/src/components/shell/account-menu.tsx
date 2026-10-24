import Link from 'next/link';
import { signOut } from '../../app/login/actions';
import { ApiError } from '../../lib/api';
import { currentMe } from '../../lib/desk-shell';
import { currentLocale } from '../../i18n/server';
import { translator } from '../../i18n';
import { Icon } from '../icon';
import { LocaleSwitch } from './locale-switch';

/**
 * Кто на смене — в меню профиля (DATA_MODEL §13.8, ADR-049). Серверный кусок внутри клиентской шапки:
 * имя приходит от API по токену сессии, а «Выйти» отзывает сессию в базе, а не просто чистит cookie.
 * Пока вход не обязателен (APP_AUTH_REQUIRED не задан), без сессии здесь просто ссылка на экран входа.
 * Язык стойки (KK1) выбирается здесь же: он у человека, а не у организации (ADR-163).
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
      <LocaleSwitch locale={locale} />
      <form action={signOut}>
        <button type="submit">
          <Icon name="departure" />
          {t('Выйти')}
        </button>
      </form>
    </>
  );
}
