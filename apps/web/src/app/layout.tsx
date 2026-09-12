import type { ReactNode } from 'react';
import { TopNav } from '../components/top-nav';
import './globals.css';

export const metadata = { title: 'PMS Luxx Aparts' };

/** Общий каркас стойки: верхняя навигация + страница. Стили — `globals.css` (срез 10, ADR-027). */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <TopNav />
        {children}
      </body>
    </html>
  );
}
