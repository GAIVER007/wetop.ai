import type { ReactNode } from 'react';
import { ThemeProvider, themeScript } from '../components/theme-provider';
import { TopNav } from '../components/top-nav';
import './globals.css';
import './workspace.css';
import './today/desk.css';
import './management/hotel.css';
import './tokens.css';
import './premium.css';

export const metadata = {
  title: 'WETOP · Luxx Aparts',
  description: 'Рабочее пространство хостела: гости, бронирования и управление размещением.',
};

/** Общий shell и параллельная карточка используют одну тему и существующие server actions. */
export default function RootLayout({
  children,
  drawer,
}: {
  children: ReactNode;
  drawer: ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          <TopNav demo={process.env.NODE_ENV !== 'production' && process.env.APP_DEMO_MODE === '1'}>
            {children}
          </TopNav>
          {drawer}
        </ThemeProvider>
      </body>
    </html>
  );
}
