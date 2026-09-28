import { describe, expect, it } from 'vitest';
import { ONBOARDING_LATER_COOKIE, needsOnboardingRedirect } from './onboarding-later';

/**
 * «Заполнить позже» в онбординге (plans/site-auth-dialog-tour-2026-09-27.md, Д3, ADR-100): гейт уводит на /onboarding,
 * пока у объекта нет номеров, — но не того, кто отложил настройку в этом браузере.
 */
describe('needsOnboardingRedirect', () => {
  const base = { path: '/today', needsOnboarding: true, postponed: false };

  it('объект без номеров — на онбординг', () => {
    expect(needsOnboardingRedirect(base)).toBe(true);
  });

  it('отложил настройку — остаётся на рабочем экране', () => {
    expect(needsOnboardingRedirect({ ...base, postponed: true })).toBe(false);
  });

  it('номера есть — гейт молчит', () => {
    expect(needsOnboardingRedirect({ ...base, needsOnboarding: false })).toBe(false);
  });

  it('вход, регистрация, приглашение, сброс пароля, онбординг и печать — без гейта, иначе цикл', () => {
    for (const path of ['/onboarding', '/login', '/login/verify', '/register', '/invite/x', '/password-reset', '/reservations/7/print/invoice']) {
      expect(needsOnboardingRedirect({ ...base, path })).toBe(false);
    }
  });

  it('отметка — своя кука, не кука сессии', () => {
    expect(ONBOARDING_LATER_COOKIE).toBe('wetop_onboarding_later');
  });
});

/*
 * После сброса платформы (ADR-118) у организации нет объекта: рабочие экраны пусты, «Заполнить позже» ничего не даёт —
 * гейт ведёт на онбординг и тогда (plans/onboarding-without-property-2026-09-28.md). Сам онбординг и вход не трогает.
 */
describe('гейт: у организации нет объекта', () => {
  it('ведёт на онбординг, даже если онбординг отложен', () => {
    expect(
      needsOnboardingRedirect({ path: '/today', needsOnboarding: false, postponed: true, propertyMissing: true }),
    ).toBe(true);
  });
  it('на онбординге, входе и печати — не ведёт: иначе цикл', () => {
    for (const path of ['/onboarding', '/login', '/reservations/R1/print'])
      expect(
        needsOnboardingRedirect({ path, needsOnboarding: false, postponed: false, propertyMissing: true }),
      ).toBe(false);
  });
});
