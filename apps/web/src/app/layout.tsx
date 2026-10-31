// CSS первым: globals.css объявляет порядок слоёв каскада (DESIGN.md §20.6), и любой CSS,
// импортированный компонентом выше, объявил бы свой слой раньше и перевернул порядок (MV8.5 DS0b).
import './globals.css';
import './components.css';
import './workspace.css';
import './tokens.css';
import './premium.css';
import '../components/shell/sidebar.css';
import '../components/shell/side-nav.css';
import '../components/shell/tab-nav.css';
import '../components/shell/cash-header.css';
import { headers } from 'next/headers';
import { unstable_rethrow } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { ThemeProvider, themeScript } from '../components/theme-provider';
import { ToastProvider } from '../components/toast';
import { TopNav } from '../components/top-nav';
import { supportContacts } from '../lib/support-contacts';
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
import { currentMe, deskShell } from '../lib/desk-shell';
import { authRequired } from '../lib/session';
import { safeReturnPath } from '../lib/auth-entry';
import { scopeResolvePath } from '../lib/scope-pointer';
import { Page } from '../components/page';
import { ApiError } from '../lib/api';
import { selectedWorkspaceBranch, workspaceTimezone } from '../lib/workspace-context';
import { isPublicEntryPath } from '../lib/public-entry';
import {
  PublicEntryExit,
  WorkspaceSessionBoundary,
} from '../components/workspace-session-boundary';
import { DevAgentation } from '../components/dev-agentation';
import { inter } from './fonts';
import { PWA_THEME } from '../lib/pwa';
import { translator } from '../i18n';
import { LocaleProvider } from '../i18n/locale-provider';
import { cookieLocale, currentLocale, serverT } from '../i18n/server';

export const metadata = {
  title: 'WETOP: рабочее пространство',
  description: 'Рабочее пространство вашего бизнеса.',
  // запуск с экрана iPhone без адресной строки (PWA1); манифест и значки Next подключает сам по app/manifest.ts
  appleWebApp: { capable: true, title: 'WETOP', statusBarStyle: 'default' as const },
};

// Без viewport-fit=cover env(safe-area-inset-*) на iPhone равны нулю, и нижняя навигация (ADR-050)
// ложится под жестовую полосу; отступы под «бровь» и полосу считает CSS этими же env().
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
  // цвет строки состояния телефона: главный цвет стойки своей темы (PWA1)
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: PWA_THEME.light },
    { media: '(prefers-color-scheme: dark)', color: PWA_THEME.dark },
  ],
};

async function ProjectProperty({ field }: { field: 'name' | 'address' }) {
  const shell = await deskShell();
  const t = await serverT();
  if (shell.branchNeeded) return field === 'name' ? t('Выберите филиал') : t('Откройте список филиалов');
  if (shell.access.unknown) return t('Филиал недоступен');
  if (shell.vertical !== 'HOSPITALITY') {
    const branch = await selectedWorkspaceBranch().catch(() => null);
    return branch
      ? field === 'name'
        ? branch.name
        : (branch.address ?? t(branch.vertical === 'FOOD_SERVICE' ? 'Ресторан' : 'Салон'))
      : t('Выберите филиал');
  }
  const hotel = await hotelApi.settings().catch((error: unknown) => {
    if (error instanceof ApiError) return null;
    throw error;
  });
  // подпись под названием, пока адрес не заполнен: вид бизнеса, как «Салон» и «Ресторан» (аудит 22.10.2026 P1-20)
  return hotel?.property[field] ?? t(field === 'name' ? 'Объект не загружен' : 'Гостиница');
}

/** Общий shell и параллельная карточка используют одну тему и существующие server actions. */
export default async function RootLayout({
  children,
  drawer,
}: {
  children: ReactNode;
  drawer: ReactNode;
}) {
  const requestHeaders = await headers();
  const path = requestHeaders.get('x-wetop-path') ?? '';
  // Вход, регистрация, ссылки из писем и приглашения доступны без сессии.
  // Защищённая оболочка здесь не нужна: её запросы `/hotel/settings` и `/auth/me`
  // при включённом замке уводят на `/login` раньше, чем токен подтверждения дойдёт до API.
  if (isPublicEntryPath(path)) {
    const locale = await cookieLocale();
    return (
      <html lang={locale} className={inter.variable} suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        </head>
        <body>
          <ClearAssistantOnPublicEntry />
          <LocaleProvider locale={locale}>
            <ThemeProvider>
              <ToastProvider>
                <PublicEntryExit>{children}</PublicEntryExit>
              </ToastProvider>
            </ThemeProvider>
          </LocaleProvider>
          {process.env.APP_UI_TEST !== '1' && <DevAgentation />}
        </body>
      </html>
    );
  }
  // Validate before rendering a protected shell. Page checks also remain necessary for client navigation.
  const protectedWorkspace = authRequired();
  let verifiedIdentity: { userId: string; organizationId: string } | null = null;
  if (protectedWorkspace) {
    try {
      const me = await currentMe();
      if (me.user)
        verifiedIdentity = { userId: me.user.id, organizationId: me.user.organizationId };
    } catch (error) {
      unstable_rethrow(error);
      if (!(error instanceof ApiError)) throw error;
      const denied = error.status === 403;
      const locale = await cookieLocale();
      const t = translator(locale);
      return (
        <html lang={locale} suppressHydrationWarning>
          <head>
            <script dangerouslySetInnerHTML={{ __html: themeScript }} />
          </head>
          <body>
            <ThemeProvider>
              <Page title={denied ? t('Нет доступа') : t('Нет связи с сервером')} width="narrow">
                <section className="empty-state" role="alert">
                  <p>
                    {denied
                      ? t('Сервер отклонил запрос. Проверьте права и выбранный филиал.')
                      : t('Проверьте подключение и повторите загрузку. Ваша сессия сохранена.')}
                  </p>
                  <div className="row">
                    <a
                      className="btn"
                      href={safeReturnPath(requestHeaders.get('x-wetop-return') ?? path)}
                    >
                      {t('Повторить загрузку')}
                    </a>
                    {denied && (
                      <a
                        className="btn btn--secondary"
                        href={scopeResolvePath(
                          safeReturnPath(requestHeaders.get('x-wetop-return') ?? path),
                        )}
                      >
                        {t('Выбрать филиал')}
                      </a>
                    )}
                  </div>
                </section>
              </Page>
            </ThemeProvider>
          </body>
        </html>
      );
    }
  }
  // Кто вошёл и что ему открыто (ADR-083): меню получает общее обещание.
  const desk = deskShell();
  // Пояс объекта для календарей и времени в клиентских компонентах (С-13) — тоже обещанием. Отказ API или
  // уход на вход здесь не решаются: их решает заголовок объекта ниже, а часам хватит пояса платформы
  const timezone = workspaceTimezone().catch(() => FALLBACK_TIMEZONE);
  // язык человека (ADR-163, KK1): `users.locale` из того же `/auth/me`, иначе кука
  const locale = await currentLocale();
  const t = translator(locale);
  return (
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <WorkspaceSessionBoundaryEnabled
          enabled={protectedWorkspace}
          identity={verifiedIdentity}
          serverPath={path}
        >
          <Suspense fallback={null}>
            <ScopeGate />
          </Suspense>
          <LocaleProvider locale={locale}>
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
                    demo={
                      process.env.NODE_ENV === 'development' && process.env.APP_DEMO_MODE === '1'
                    }
                    desk={desk}
                    support={supportContacts(process.env) !== null}
                    property={{
                      name: (
                        <Suspense fallback={t('Объект не загружен')}>
                          <ProjectProperty field="name" />
                        </Suspense>
                      ),
                      address: (
                        <Suspense fallback={t('Гостиница')}>
                          <ProjectProperty field="address" />
                        </Suspense>
                      ),
                    }}
                  >
                    {/* подсказка гейта под шапкой, в рабочей области (аудит кабинета 31.10.2026): раньше висела над шапкой */}
                    <Suspense fallback={null}>
                      <OnboardingGate />
                    </Suspense>
                    <AccessGate>{children}</AccessGate>
                  </TopNav>
                  {drawer}
                </ToastProvider>
              </DeskAccessProvider>
            </PropertyTimeProvider>
          </ThemeProvider>
          </LocaleProvider>
          {/* Чат ИИ-помощника на каждом экране (ТЗ П2): без ASSISTANT_URL ничего не рисует */}
          <Suspense fallback={null}>
            <WorkspaceAssistant desk={desk} />
          </Suspense>
        </WorkspaceSessionBoundaryEnabled>
        {process.env.APP_UI_TEST !== '1' && <DevAgentation />}
      </body>
    </html>
  );
}

function WorkspaceSessionBoundaryEnabled({
  children,
  enabled,
  identity,
  serverPath,
}: {
  children: ReactNode;
  enabled: boolean;
  identity: { userId: string; organizationId: string } | null;
  serverPath: string;
}) {
  return enabled && identity ? (
    <WorkspaceSessionBoundary identity={identity} serverPath={serverPath}>
      {children}
    </WorkspaceSessionBoundary>
  ) : (
    children
  );
}

async function WorkspaceAssistant({ desk }: { desk: Promise<DeskShell> }) {
  const shell = await desk;
  return shell.vertical !== 'HOSPITALITY' || shell.access.unknown ? null : <AssistantWidget />;
}
