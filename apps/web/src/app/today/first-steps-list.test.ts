import { describe, expect, it } from 'vitest';
import { firstStepsFor } from './first-steps-list';

/** «Заполнить позже» (ADR-100): номеров нет — Главная первым шагом ведёт их настроить, а не создавать бронь. */
describe('firstStepsFor', () => {
  it('объект настроен — «Отель запущен» готово, следующий шаг — первая бронь', () => {
    const steps = firstStepsFor(false);
    expect(steps[0]).toMatchObject({ title: 'Отель запущен', state: 'done' });
    expect(steps.find((s) => s.state === 'next')?.action?.href).toBe('/reservations/new');
  });

  it('онбординг отложен — первый шаг ведёт на /onboarding, «запущен» не обещаем', () => {
    const steps = firstStepsFor(true);
    expect(steps[0]).toMatchObject({ state: 'next', action: { href: '/onboarding' } });
    expect(steps.some((s) => s.title === 'Отель запущен')).toBe(false);
    expect(steps.filter((s) => s.state === 'next')).toHaveLength(1);
  });

  it('до настройки кнопки «Создать первую бронь» нет — бронь не на что ставить', () => {
    expect(firstStepsFor(true).some((s) => s.action?.href === '/reservations/new')).toBe(false);
  });

  it('шаги с правом (ADR-106): настройка отеля — `settings`, приглашение сотрудников — `staff`', () => {
    const setup = firstStepsFor(true).find((s) => s.action?.href === '/onboarding');
    const invite = firstStepsFor(false).find((s) => s.action?.href === '/login');
    expect(setup?.requires).toBe('settings');
    expect(invite?.requires).toBe('staff');
    // работа с бронью — у всех ролей
    expect(
      firstStepsFor(false).find((s) => s.action?.href === '/reservations/new')?.requires,
    ).toBeUndefined();
  });
});
