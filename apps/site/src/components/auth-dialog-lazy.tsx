'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type { AuthDialog } from './auth-dialog';

/*
 * Ленивая обёртка окна входа (ТЗ §14, замер CWV 10.10.2026): AuthDialog — самый тяжёлый клиентский
 * кусок главной, а нужен только после щелчка по «Войти»/«Регистрация» или заходу с #login/#register.
 * dynamic без SSR убирает его из первой гидрации; сам компонент и auth-логика не менялись, обработка
 * хэша в нём срабатывает при монтировании, то есть в тот же момент после загрузки, что и раньше.
 */
const LazyAuthDialog = dynamic(() => import('./auth-dialog').then((m) => m.AuthDialog), {
  ssr: false,
});

export function AuthDialogLazy(props: ComponentProps<typeof AuthDialog>) {
  return <LazyAuthDialog {...props} />;
}
