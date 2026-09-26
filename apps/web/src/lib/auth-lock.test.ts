import { describe, expect, it } from 'vitest';
import { lockRequired } from './auth-lock';

/**
 * ТЗ аудита 25.09.2026, В-2: замок стойки fail-closed — как у API. В production он включён всегда
 * и выключается только явным '0'; на dev-стендах и в тестах прежнее поведение ('1' включает),
 * чтобы сквозные наборы и демонстрационный режим не требовали входа.
 */
describe('lockRequired: замок стойки', () => {
  it('в production включён при любом значении, кроме явного нуля', () => {
    expect(lockRequired(undefined, 'production')).toBe(true);
    expect(lockRequired('', 'production')).toBe(true);
    expect(lockRequired('true', 'production')).toBe(true);
    expect(lockRequired('1', 'production')).toBe(true);
    expect(lockRequired('0', 'production')).toBe(false);
  });

  it('вне production включается только явной единицей', () => {
    expect(lockRequired(undefined, 'development')).toBe(false);
    expect(lockRequired(undefined, 'test')).toBe(false);
    expect(lockRequired('1', 'development')).toBe(true);
    expect(lockRequired('0', 'development')).toBe(false);
  });
});
