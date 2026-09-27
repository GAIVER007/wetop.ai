import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { hotelApi } from '../lib/hotel-api';
import { ApiError } from '../lib/api';
import { ONBOARDING_LATER_COOKIE, needsOnboardingRedirect } from '../lib/onboarding-later';

/**
 * Гейт онбординга: пока у объекта организации нет номеров, рабочие экраны уводят на /onboarding
 * (plans/onboarding-2026-09-21.md). Кто нажал «Заполнить позже», остаётся на рабочих экранах
 * (ADR-100); какие пути гейт не трогает — `lib/onboarding-later.ts`.
 */
export async function OnboardingGate() {
  const path = (await headers()).get('x-wetop-path') ?? '';
  const postponed = Boolean((await cookies()).get(ONBOARDING_LATER_COOKIE)?.value);
  if (!needsOnboardingRedirect({ path, needsOnboarding: true, postponed })) return null;
  // Берём те же настройки, что и шапка объекта (кэшируются на рендер) — отдельного рейса гейт не делает
  const settings = await hotelApi.settings().catch((e: unknown) => {
    // Не вошёл / объект ещё не настроен — это решают сами страницы, гейт молчит
    if (e instanceof ApiError) return null;
    throw e;
  });
  if (settings?.needsOnboarding) redirect('/onboarding');
  return null;
}
