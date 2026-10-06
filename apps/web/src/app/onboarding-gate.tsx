import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { hotelApi } from '../lib/hotel-api';
import { ApiError } from '../lib/api';
import { ONBOARDING_LATER_COOKIE, needsOnboardingRedirect } from '../lib/onboarding-later';
import { deskShell } from '../lib/desk-shell';

/**
 * Гейт онбординга: пока у объекта организации нет номеров, рабочие экраны уводят на /onboarding
 * (plans/onboarding-2026-09-21.md). Кто нажал «Заполнить позже», остаётся на рабочих экранах
 * (ADR-100); какие пути гейт не трогает — `lib/onboarding-later.ts`.
 */
export async function OnboardingGate() {
  const path = (await headers()).get('x-wetop-path') ?? '';
  const postponed = Boolean((await cookies()).get(ONBOARDING_LATER_COOKIE)?.value);
  // Путь, где гейт вообще работает; отложенный онбординг проверяется ниже — объекта может не быть вовсе
  if (!needsOnboardingRedirect({ path, needsOnboarding: true, postponed: false })) return null;
  const { vertical, access } = await deskShell();
  if(access.unknown)return null;
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
  if (needsOnboardingRedirect({ path, needsOnboarding, postponed, propertyMissing, vertical }))
    redirect('/onboarding');
  return null;
}
