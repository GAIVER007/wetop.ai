import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { hotelApi } from '../lib/hotel-api';
import { ApiError } from '../lib/api';

/**
 * Гейт онбординга: пока у объекта организации нет номеров, рабочие экраны уводят на /onboarding
 * (plans/onboarding-2026-09-21.md). Проверяем только на «рабочих» путях — не на самом онбординге,
 * входе, регистрации, приглашении и печатных страницах, иначе был бы цикл.
 */
const SKIP = ['/onboarding', '/login', '/register', '/invite', '/password-reset'];

export async function OnboardingGate() {
  const path = (await headers()).get('x-wetop-path') ?? '';
  if (SKIP.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  if (path.includes('/print')) return null;
  // Берём те же настройки, что и шапка объекта (кэшируются на рендер) — отдельного рейса гейт не делает
  const settings = await hotelApi.settings().catch((e: unknown) => {
    // Не вошёл / объект ещё не настроен — это решают сами страницы, гейт молчит
    if (e instanceof ApiError) return null;
    throw e;
  });
  if (settings?.needsOnboarding) redirect('/onboarding');
  return null;
}
