import type { ReactNode } from 'react';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { TopNav } from '../components/top-nav';
import './globals.css';

/*
 * Шрифты стойки: IBM Plex Sans — весь интерфейс, включая заголовки (две гарнитуры на плотных экранах
 * читаются как склейка), IBM Plex Mono — номера броней и ячеек. next/font кладёт файлы в сборку:
 * стойка не ходит за шрифтами в интернет.
 */
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
    <html lang="ru" className={`${body.variable} ${mono.variable}`}>
      <body>
        <TopNav />
        {children}
      </body>
    </html>
  );
}
