import { describe, expect, it } from 'vitest';
import { chooseTestDataSource } from '../tools/test-schema-plan';

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
