import { Suspense, type ReactNode } from 'react';
import { ThemeProvider, themeScript } from '../components/theme-provider';
import { TopNav } from '../components/top-nav';
import { hotelApi } from '../lib/hotel-api';
import { ApiError } from '../lib/api';
import './globals.css';
import './workspace.css';
import './today/desk.css';
import './management/hotel.css';
import './tokens.css';
import './premium.css';

export const metadata = {
  title: 'WETOP · Управление гостиницей',
  description: 'Рабочее пространство хостела: гости, бронирования и управление размещением.',
};

async function ProjectShell({ children }: { children: ReactNode }) {
  const hotel = await hotelApi.settings().catch((error: unknown) => {
    if (error instanceof ApiError) return null;
    throw error;
  });
  return (
    <TopNav
      property={hotel?.property ?? null}
      demo={process.env.NODE_ENV === 'development' && process.env.APP_DEMO_MODE === '1'}
    >
      {children}
    </TopNav>
  );
}

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
          <Suspense
            fallback={
              <TopNav
                demo={process.env.NODE_ENV === 'development' && process.env.APP_DEMO_MODE === '1'}
              >
                {children}
              </TopNav>
            }
          >
            <ProjectShell>{children}</ProjectShell>
          </Suspense>
          {drawer}
        </ThemeProvider>
      </body>
    </html>
  );
}
