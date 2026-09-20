import { Suspense, type ReactNode } from 'react';
import { ThemeProvider, themeScript } from '../components/theme-provider';
import { ToastProvider } from '../components/toast';
import { TopNav } from '../components/top-nav';
import { AccountMenu } from '../components/shell/account-menu';
import { hotelApi } from '../lib/hotel-api';
import { ApiError } from '../lib/api';
import './globals.css';
import './workspace.css';
import './today/desk.css';
import './today/dashboard.css';
import './management/hotel.css';
import './tokens.css';
import './premium.css';
import '../components/shell/sidebar.css';
import './hotel-settings/settings.css';

export const metadata = {
  title: 'WETOP · Управление гостиницей',
  description: 'Рабочее пространство хостела: гости, бронирования и управление размещением.',
};

async function ProjectProperty({ field }: { field: 'name' | 'address' }) {
  const hotel = await hotelApi.settings().catch((error: unknown) => {
    if (error instanceof ApiError) return null;
    throw error;
  });
  return (
    hotel?.property[field] ?? (field === 'name' ? 'Объект не загружен' : 'Настройки гостиницы')
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
          <ToastProvider>
            <TopNav
              account={
                <Suspense fallback={null}>
                  <AccountMenu />
                </Suspense>
              }
              demo={process.env.NODE_ENV === 'development' && process.env.APP_DEMO_MODE === '1'}
              property={{
                name: (
                  <Suspense fallback="Объект не загружен">
                    <ProjectProperty field="name" />
                  </Suspense>
                ),
                address: (
                  <Suspense fallback="Настройки гостиницы">
                    <ProjectProperty field="address" />
                  </Suspense>
                ),
              }}
            >
              {children}
            </TopNav>
            {drawer}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
