import { headers } from 'next/headers';
import { Suspense, type ReactNode } from 'react';
import { ThemeProvider, themeScript } from '../components/theme-provider';
import { ToastProvider } from '../components/toast';
import { TopNav } from '../components/top-nav';
import { AccountMenu } from '../components/shell/account-menu';
import { AssistantWidget } from '../components/shell/assistant-widget';
import { ClearAssistantOnPublicEntry } from '../components/shell/assistant-widget-script';
import { OnboardingGate } from './onboarding-gate';
import { PropertyTimeProvider } from '../components/property-time';
import { DeskAccessProvider } from '../components/desk-access';
import { AccessGate } from '../components/access-gate';
import { hotelApi, propertyTimezone } from '../lib/hotel-api';
import { FALLBACK_TIMEZONE } from '../lib/property-time';
import { deskShell } from '../lib/desk-shell';
import { ApiError, branchesApi } from '../lib/api';
import './globals.css';
import './workspace.css';
import './today/desk.css';
import './today/dashboard.css';
import './management/hotel.css';
import './tokens.css';
import './premium.css';
import '../components/shell/sidebar.css';
import '../components/shell/top-menu.css';
import './hotel-settings/settings.css';
import './control.css';
// Общие непрозрачные поверхности без бликов — последними (DESIGN.md §20, 01.10.2026).
import './glass.css';

export const metadata = {
  title: 'WETOP · Управление гостиницей',
  description: 'Рабочее пространство хостела: гости, бронирования и управление размещением.',
};

// Без viewport-fit=cover env(safe-area-inset-*) на iPhone равны нулю, и нижняя навигация (ADR-050)
// ложится под жестовую полосу; отступы под «бровь» и полосу считает CSS этими же env().
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
};

/** Public entry screens must never start authenticated hotel requests from the workspace shell. */
function isPublicEntryPath(path: string): boolean {
  return ['/create', '/login', '/register', '/invite', '/auth/fallback'].some(
    (entry) => path === entry || path.startsWith(`${entry}/`),
  );
}

async function ProjectProperty({ field }: { field: 'name' | 'address' }) {
  const hotel = await hotelApi.settings().catch((error: unknown) => {
    if (error instanceof ApiError) return null;
    throw error;
  });
  if (hotel) return hotel.property[field];
  // Филиал салона объекта не имеет (DATA_MODEL §19, срез B2): в карточке его имя, а не «объект не загружен»
  const salon = await branchesApi
    .list()
    .then(({ items }) => items.find((item) => item.vertical === 'BEAUTY') ?? null)
    .catch(() => null);
  if (salon) return field === 'name' ? salon.name : (salon.address ?? 'Салон');
  return field === 'name' ? 'Объект не загружен' : 'Настройки объекта';
}

/** Общий shell и параллельная карточка используют одну тему и существующие server actions. */
export default async function RootLayout({
  children,
  drawer,
}: {
  children: ReactNode;
  drawer: ReactNode;
}) {
  const path = (await headers()).get('x-wetop-path') ?? '';
  // Вход, регистрация, ссылки из писем и приглашения доступны без сессии.
  // Защищённая оболочка здесь не нужна: её запросы `/hotel/settings` и `/auth/me`
  // при включённом замке уводят на `/login` раньше, чем токен подтверждения дойдёт до API.
  if (isPublicEntryPath(path)) {
    return (
      <html lang="ru" suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        </head>
        <body>
          <ClearAssistantOnPublicEntry />
          <ThemeProvider>
            <ToastProvider>{children}</ToastProvider>
          </ThemeProvider>
        </body>
      </html>
    );
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
            {/* кто вошёл — кнопкам и закрытым по роли страницам (ADR-107): то же обещание, что у меню */}
            <DeskAccessProvider desk={desk}>
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
                      <Suspense fallback="Настройки объекта">
                        <ProjectProperty field="address" />
                      </Suspense>
                    ),
                  }}
                >
                  <AccessGate>{children}</AccessGate>
                </TopNav>
                {drawer}
              </ToastProvider>
            </DeskAccessProvider>
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
