/**
 * «Заполнить позже» в онбординге (plans/site-auth-dialog-tour-2026-09-27.md, Д3, ADR-100).
 *
 * Отметка живёт кукой браузера, а не в базе: отметка в базе — правка модели (AGENTS.md §2), а по сути это
 * предпочтение человека на этом устройстве. Номеров у объекта от неё не прибавляется, поэтому «Первые шаги» на
 * Главной всё равно ведут настроить номера, а в другом браузере онбординг предложится снова.
 */
export const ONBOARDING_LATER_COOKIE = 'wetop_onboarding_later';
/** 30 суток — как сессия (`SESSION_MAX_AGE_SECONDS`): дольше напоминать незачем, короче — назойливо. */
export const ONBOARDING_LATER_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** Пути, где гейт не работает: сам онбординг, вход, регистрация, приглашение, сброс пароля — иначе был бы цикл. */
const SKIP = ['/onboarding', '/login', '/register', '/invite', '/password-reset'];

export function needsOnboardingRedirect(input: {
  path: string;
  needsOnboarding: boolean;
  postponed: boolean;
  /** У организации нет объекта (после сброса, ADR-118): рабочие экраны пусты, «позже» не помогает */
  propertyMissing?: boolean;
}): boolean {
  const { path } = input;
  if (SKIP.some((p) => path === p || path.startsWith(`${p}/`))) return false;
  if (path.includes('/print')) return false;
  if (input.propertyMissing) return true;
  return input.needsOnboarding && !input.postponed;
}
