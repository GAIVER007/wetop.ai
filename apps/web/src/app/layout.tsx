import { headers } from 'next/headers';
import { Suspense, type ReactNode } from 'react';
import { ThemeProvider, themeScript } from '../components/theme-provider';
import { ToastProvider } from '../components/toast';
import { TopNav } from '../components/top-nav';
import { AccountMenu } from '../components/shell/account-menu';
import { AssistantWidget } from '../components/shell/assistant-widget';
import { OnboardingGate } from './onboarding-gate';
import { PropertyTimeProvider } from '../components/property-time';
import { hotelApi, propertyTimezone } from '../lib/hotel-api';
import { FALLBACK_TIMEZONE } from '../lib/property-time';
import { deskShell } from '../lib/desk-shell';
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
import './control.css';
// Стеклянный слой — последним: он добавляет свет, размытие и кромку к уже собранным блокам (DESIGN.md §20).
import './glass.css';

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
export default async function RootLayout({
  children,
  drawer,
}: {
  children: ReactNode;
  drawer: ReactNode;
}) {
  // Public creation does not fetch hotel data or start the authenticated desk shell.
  if ((await headers()).get('x-wetop-path') === '/create') {
    return <html lang="ru" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body><ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider></body>
    </html>;
  }
  // Кто вошёл и что ему открыто (ADR-083): меню получает обещание и не задерживает страницу
  const desk = deskShell();
  // Пояс объекта для календарей и времени в клиентских компонентах (С-13) — тоже обещанием. Отказ API или
  // уход на вход здесь не решаются: их решает заголовок объекта ниже, а часам хватит пояса платформы
  const timezone = propertyTimezone().catch(() => FALLBACK_TIMEZONE);
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Suspense fallback={null}>
          <OnboardingGate />
        </Suspense>
        <ThemeProvider>
          <PropertyTimeProvider timezone={timezone}>
            <ToastProvider>
              <TopNav
                account={
                  <Suspense fallback={null}>
                    <AccountMenu />
                  </Suspense>
                }
                demo={process.env.NODE_ENV === 'development' && process.env.APP_DEMO_MODE === '1'}
                desk={desk}
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
          </PropertyTimeProvider>
        </ThemeProvider>
        {/* Чат ИИ-помощника на каждом экране (ТЗ П2): без ASSISTANT_URL ничего не рисует */}
        <Suspense fallback={null}>
          <AssistantWidget />
        </Suspense>
      </body>
    </html>
  );
}
