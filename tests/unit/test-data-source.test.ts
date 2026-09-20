import { describe, expect, it } from 'vitest';
import { chooseTestDataSource, seedIsStale } from '../tools/test-schema-plan';

/** Выбор источника данных для pms_test (plans/tests-without-live-db-2026-09-15.md, шаг 2) */
describe('chooseTestDataSource', () => {
  it('без переменной: копия, если рабочая схема с данными, иначе сид', () => {
    expect(chooseTestDataSource(undefined, true)).toBe('copy');
    expect(chooseTestDataSource('', true)).toBe('copy');
    expect(chooseTestDataSource(undefined, false)).toBe('seed');
  });
  it('переменная побеждает состояние базы', () => {
    expect(chooseTestDataSource('seed', true)).toBe('seed');
    expect(chooseTestDataSource('copy', false)).toBe('copy');
  });
  it('незнакомое значение — ошибка, не умолчание', () => {
    expect(() => chooseTestDataSource('live', true)).toThrow(/TEST_DATA=live/);
  });
});

/**
 * Сид держит занятость вокруг «сегодня» (−10…+2 ночей, `tests/tools/test-seed.ts`), а с +3 начинаются
 * окна спеков. Сид, засеянный позавчера, к сегодняшнему дню пуст: 19.09.2026 `chessboard.spec` увидел
 * занято 0 на сиде от 16.09. Значит, сид старше сегодняшнего дня надо засеять заново, а не копию считать
 * свежей: у копии рабочих данных даты настоящие, и её день не важен.
 */
describe('seedIsStale', () => {
  it('сид не с сегодняшнего дня (по Алматы) — устарел', () => {
    expect(seedIsStale('2026-09-16T20:30:00.000Z (сид)', '2026-09-19')).toBe(true);
    // 21:30 UTC 18.09 — это уже 02:30 19.09 по Алмати: сид сегодняшний
    expect(seedIsStale('2026-09-18T21:30:00.000Z (сид)', '2026-09-19')).toBe(false);
    expect(seedIsStale('2026-09-19T05:00:00.000Z (сид)', '2026-09-19')).toBe(false);
  });
  it('копия рабочих данных не стареет, как и отсутствие отметки', () => {
    expect(seedIsStale('2026-09-10T10:00:00.000Z', '2026-09-19')).toBe(false);
    expect(seedIsStale(null, '2026-09-19')).toBe(false);
  });
});
