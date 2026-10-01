import { describe, expect, it } from 'vitest';
import { TOUR_STEPS, tourKeyOf, tourStepsFor, shouldAutoStartTour } from './tour-steps';

/**
 * Обучение в стойке (plans/site-auth-dialog-tour-2026-09-27.md, Д4, ADR-100): шаги привязаны к элементам меню через
 * `data-tour`. Элемента нет — шаг без подсветки или пропущен; отметка «пройдено» — своя у каждого вошедшего.
 */
describe('TOUR_STEPS', () => {
  it('первый шаг — приветствие без элемента, последний — как вернуться к обучению', () => {
    expect(TOUR_STEPS[0]?.target).toBeNull();
    expect(TOUR_STEPS.at(-1)?.target).toBe('profile');
    expect(TOUR_STEPS.at(-1)?.text).toMatch(/Обучение/);
  });

  it('у каждого шага — заголовок и текст, цели не повторяются', () => {
    for (const step of TOUR_STEPS) {
      expect(step.title.trim()).not.toBe('');
      expect(step.text.trim()).not.toBe('');
    }
    const targets = TOUR_STEPS.map((s) => s.target).filter(Boolean);
    expect(new Set(targets).size).toBe(targets.length);
  });
});

describe('tourStepsFor', () => {
  it('элемент на экране — шаг с подсветкой', () => {
    const steps = tourStepsFor(() => true);
    expect(steps).toHaveLength(TOUR_STEPS.length);
    expect(steps.every((s) => s.target === null || s.highlight)).toBe(true);
  });

  it('закрытый по правам раздел — шаг пропущен независимо от разметки', () => {
    const steps = tourStepsFor(
      () => true,
      TOUR_STEPS,
      (permission) => permission !== 'rates',
    );
    expect(steps.some((s) => s.target === 'section-sales')).toBe(false);
  });

  it('обязательный шаг без элемента (телефон, меню свёрнуто) — остаётся, но без подсветки', () => {
    const steps = tourStepsFor(() => false);
    const search = steps.find((s) => s.target === 'search');
    expect(search).toBeDefined();
    expect(search?.highlight).toBe(false);
  });
});

describe('tourKeyOf', () => {
  it('ключ свой у каждой почты, без самой почты в хранилище браузера', () => {
    const a = tourKeyOf('Dana@Example.invalid');
    expect(a).toBe(tourKeyOf('dana@example.invalid '));
    expect(a).not.toContain('dana');
    expect(a).not.toBe(tourKeyOf('aru@example.invalid'));
    expect(a).toMatch(/^wetop\.tour\.v1:/);
  });
});

describe('shouldAutoStartTour', () => {
  it('сам стартует один раз — на Главной, у вошедшего, пока не пройдено', () => {
    expect(shouldAutoStartTour({ path: '/today', key: 'k', done: false })).toBe(true);
    expect(shouldAutoStartTour({ path: '/today', key: 'k', done: true })).toBe(false);
    expect(shouldAutoStartTour({ path: '/chessboard', key: 'k', done: false })).toBe(false);
    expect(shouldAutoStartTour({ path: '/today', key: null, done: false })).toBe(false);
  });
});

it('обучение скрывает недоступные права, а доступные темы остаются на телефоне', () => {
  const mobile = tourStepsFor(
    () => false,
    TOUR_STEPS,
    (permission) => permission === 'desk',
  );
  expect(mobile.some((s) => s.title === 'Шахматка: размещение и продление')).toBe(true);
  expect(mobile.some((s) => s.target === 'section-settings')).toBe(false);
  expect(mobile.every((s) => !s.highlight)).toBe(true);
});
