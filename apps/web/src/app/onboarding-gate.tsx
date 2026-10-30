import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { hotelApi } from '../lib/hotel-api';
import { ApiError, sharedOnboardingApi } from '../lib/api';
import { ONBOARDING_LATER_COOKIE, needsOnboardingRedirect } from '../lib/onboarding-later';
import { currentMe, deskShell } from '../lib/desk-shell';
import { serverT } from '../i18n/server';

/**
 * Гейт онбординга: пока у объекта организации нет номеров, рабочие экраны уводят на /onboarding
 * (plans/onboarding-2026-09-21.md). Кто нажал «Заполнить позже», остаётся на рабочих экранах
 * (ADR-100); какие пути гейт не трогает — `lib/onboarding-later.ts`.
 */
export async function OnboardingGate() {
  const path = (await headers()).get('x-wetop-path') ?? '';
  const postponed = Boolean((await cookies()).get(ONBOARDING_LATER_COOKIE)?.value);
  // Путь, где гейт вообще работает; отложенный онбординг проверяется ниже — объекта может не быть вовсе
  const settingsPath = path === '/hotel-settings' || path.startsWith('/hotel-settings/');
  if (!settingsPath && !needsOnboardingRedirect({ path, needsOnboarding: true, postponed: false }))
    return null;
  const { vertical, access } = await deskShell();
  if (access.unknown) return null;
  if (vertical === 'BEAUTY' && (path === '/today' || path === '/calendar')) {
    const t = await serverT();
    try {
      const state = await sharedOnboardingApi.status();
      if (state.completedAt && !state.readiness?.ready)
        return (
          <div className="alert" role="status">
            <p>{t('Настройка салона требует проверки. Рабочее пространство доступно.')}</p>
            <a href="/register/setup">{t('Проверить услуги, мастеров и график')}</a>
          </div>
        );
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      return (
        <div className="alert" role="status">
          <p>{t('Не удалось проверить готовность салона.')}</p>
          <a href="/register/setup">{t('Повторить проверку')}</a>
        </div>
      );
    }
    return null;
  }
  if (vertical !== 'HOSPITALITY') return null;
  // Берём те же настройки, что и шапка объекта (кэшируются на рендер) — отдельного рейса гейт не делает
  const settings = await hotelApi.settings().catch((e: unknown) => {
    if (e instanceof ApiError) return e;
    throw e;
  });
  // Вертикаль филиала берётся из того же /auth/me, что меню (кэш на рендер): лишнего рейса гейт не делает
  // 404 — у организации нет объекта (после сброса, ADR-118): онбординг его и создаст
  // (plans/onboarding-without-property-2026-09-28.md). Не вошёл и прочие отказы решают сами страницы.
  const propertyMissing = settings instanceof ApiError && settings.status === 404;
  const needsOnboarding = !(settings instanceof ApiError) && Boolean(settings?.needsOnboarding);
  // учётка компании WETOP (миграция 171): гостиницу ей не предлагаем (владелец 30.10.2026)
  const me = await currentMe().catch(() => null);
  const cabinetHome = me?.user?.platformAdmin === true && me.user.cabinetHome === true;
  if (needsOnboardingRedirect({ path, needsOnboarding, postponed, propertyMissing, vertical, cabinetHome }))
    redirect('/onboarding');
  return null;
}
