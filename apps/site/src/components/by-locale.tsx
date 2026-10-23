'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/*
 * Каркас страницы на языке адреса (аудит 22.10.2026, P1-12). Шапка и подвал живут в корневом макете, общем для
 * русских и казахских страниц, а язык знает только адрес: сервер рисует оба варианта, здесь остаётся тот,
 * что подходит к пути. При статической сборке путь страницы известен, в HTML попадает нужный вариант.
 */
export function isKkPath(pathname: string | null): boolean {
  return pathname === '/kk' || (pathname ?? '').startsWith('/kk/');
}

export function ByLocale({ ru, kk }: { ru: ReactNode; kk: ReactNode }) {
  return <>{isKkPath(usePathname()) ? kk : ru}</>;
}
