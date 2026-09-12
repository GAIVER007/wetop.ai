import type { ReactNode } from 'react';
import { IBM_Plex_Mono, IBM_Plex_Sans, Manrope } from 'next/font/google';
import { TopNav } from '../components/top-nav';
import './globals.css';

/*
 * Шрифты дизайна стойки (направление A, 12.09.2026): Manrope — заголовки и числа, IBM Plex Sans — текст,
 * IBM Plex Mono — номера броней. next/font кладёт файлы в сборку: стойка не ходит за шрифтами в интернет.
 */
const head = Manrope({
  subsets: ['cyrillic', 'latin'],
  weight: ['600', '700', '800'],
  variable: '--font-head',
  display: 'swap',
});
const body = IBM_Plex_Sans({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
});
const mono = IBM_Plex_Mono({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata = { title: 'PMS Luxx Aparts' };

/** Общий каркас стойки: верхняя навигация + страница. Стили — `globals.css` (срез 10, ADR-027). */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${head.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <TopNav />
        {children}
      </body>
    </html>
  );
}
