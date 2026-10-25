import { cookies } from 'next/headers';
import { unstable_rethrow } from 'next/navigation';
import { cache } from 'react';
import { currentMe } from '../lib/desk-shell';
import { LOCALE_COOKIE, deskLocale, translator, type DeskLocale, type Translate } from './index';

/**
 * Язык по куке: страницы без сессии (вход, ссылки из писем) и сбой `/auth/me`. Вне запроса Next (unit-тесты,
 * служебный вызов) куки нет: язык русский. Управление Next (динамическая отрисовка) пропускается дальше.
 */
export async function cookieLocale(): Promise<DeskLocale> {
  try {
    return deskLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  } catch (error) {
    unstable_rethrow(error);
    return 'ru';
  }
}

/**
 * Язык вошедшего: `users.locale` из того же `/auth/me`, что у меню (кэш на отрисовку), иначе кука. Переход на вход
 * и другое управление Next пропускаются дальше, как у остальных читателей `currentMe`.
 */
export const currentLocale = cache(async (): Promise<DeskLocale> => {
  try {
    const me = await currentMe();
    if (me.user && me.locale) return deskLocale(me.locale);
  } catch (error) {
    unstable_rethrow(error);
  }
  return cookieLocale();
});

export async function serverT(): Promise<Translate> {
  return translator(await currentLocale());
}
