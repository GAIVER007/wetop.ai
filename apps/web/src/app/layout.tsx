// CSS первым: globals.css объявляет порядок слоёв каскада (DESIGN.md §20.6), и любой CSS,
// импортированный компонентом выше, объявил бы свой слой раньше и перевернул порядок (MV8.5 DS0b).
import './globals.css';
import './components.css';
import './workspace.css';
import './tokens.css';
import './premium.css';
import '../components/shell/sidebar.css';
import '../components/shell/side-nav.css';
import { headers } from 'next/headers';
import { Suspense, type ReactNode } from 'react';
import { ThemeProvider, themeScript } from '../components/theme-provider';
import { ToastProvider } from '../components/toast';
import { TopNav } from '../components/top-nav';
import { AccountMenu } from '../components/shell/account-menu';
import { AssistantWidget } from '../components/shell/assistant-widget';
import { ClearAssistantOnPublicEntry } from '../components/shell/assistant-widget-script';
import { OnboardingGate } from './onboarding-gate';
import { ScopeGate } from './scope-gate';
import { PropertyTimeProvider } from '../components/property-time';
import { DeskAccessProvider } from '../components/desk-access';
import { AccessGate } from '../components/access-gate';
import { hotelApi } from '../lib/hotel-api';
import { FALLBACK_TIMEZONE } from '../lib/property-time';
import type { DeskShell } from '../lib/desk-person';
import { deskShell } from '../lib/desk-shell';
import { ApiError } from '../lib/api';
import { selectedWorkspaceBranch, workspaceTimezone } from '../lib/workspace-context';

export const metadata = {
  title: 'WETOP: рабочее пространство',
  description: 'Рабочее пространство вашего бизнеса.',
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
  return ['/create', '/login', '/register', '/invite', '/auth/fallback', '/status'].some(
    (entry) => path === entry || path.startsWith(`${entry}/`),
  );
}

async function ProjectProperty({ field }: { field: 'name' | 'address' }) {
  const shell = await deskShell();
  if (shell.access.unknown) return 'Филиал недоступен';
  if (shell.vertical !== 'HOSPITALITY') {
    const branch = await selectedWorkspaceBranch().catch(() => null);
    return branch
      ? field === 'name'
        ? branch.name
        : (branch.address ?? (branch.vertical === 'FOOD_SERVICE' ? 'Ресторан' : 'Салон'))
      : 'Выберите филиал';
  }
  const hotel = await hotelApi.settings().catch((error: unknown) => {
    if (error instanceof ApiError) return null;
    throw error;
  });
  return hotel?.property[field] ?? (field === 'name' ? 'Объект не загружен' : 'Настройки объекта');
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
  const timezone = workspaceTimezone().catch(() => FALLBACK_TIMEZONE);
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Suspense fallback={null}>
          <ScopeGate />
        </Suspense>
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
          <WorkspaceAssistant desk={desk} />
        </Suspense>
      </body>
    </html>
  );
}

async function WorkspaceAssistant({ desk }: { desk: Promise<DeskShell> }) {
  const shell = await desk;
  return shell.vertical !== 'HOSPITALITY' || shell.access.unknown ? null : <AssistantWidget />;
}
