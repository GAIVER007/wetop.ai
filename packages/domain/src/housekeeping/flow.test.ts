import { describe, expect, it } from 'vitest';
import {
  HOUSEKEEPING_FLOW,
  HOUSEKEEPING_RU,
  housekeepingRefusal,
  housekeepingTargets,
  nextHousekeepingStatus,
} from './flow';

describe('цикл уборки: требует уборки → убрано → проверено (доступна)', () => {
  it('порядок шагов фиксирован, у «проверено» следующего шага нет', () => {
    expect(HOUSEKEEPING_FLOW).toEqual(['DIRTY', 'CLEAN', 'INSPECTED']);
    expect(nextHousekeepingStatus('DIRTY')).toBe('CLEAN');
    expect(nextHousekeepingStatus('CLEAN')).toBe('INSPECTED');
    expect(nextHousekeepingStatus('INSPECTED')).toBeNull();
  });

  it('вперёд — только на шаг, назад — только в «требует уборки»', () => {
    expect(housekeepingTargets('DIRTY')).toEqual(['CLEAN']);
    expect(housekeepingTargets('CLEAN')).toEqual(['INSPECTED', 'DIRTY']);
    expect(housekeepingTargets('INSPECTED')).toEqual(['DIRTY']);
  });

  it('перепрыгнуть проверку нельзя, и причина названа словами', () => {
    expect(housekeepingRefusal('DIRTY', 'INSPECTED')).toMatch(/сначала «Убрано»/);
    expect(housekeepingRefusal('INSPECTED', 'CLEAN')).toMatch(/уже проверена/);
    expect(housekeepingRefusal('DIRTY', 'CLEAN')).toBeNull();
    expect(housekeepingRefusal('CLEAN', 'INSPECTED')).toBeNull();
    expect(housekeepingRefusal('CLEAN', 'DIRTY')).toBeNull();
    expect(housekeepingRefusal('INSPECTED', 'DIRTY')).toBeNull();
  });

  it('тот же статус — не переход и не отказ: повторное нажатие безвредно', () => {
    for (const s of HOUSEKEEPING_FLOW) expect(housekeepingRefusal(s, s)).toBeNull();
  });

  it('слова стойки: статус назван тем, что с ячейкой делать; «проверено» — что она доступна', () => {
    expect(HOUSEKEEPING_RU.DIRTY).toBe('требует уборки');
    expect(HOUSEKEEPING_RU.CLEAN).toBe('убрано, ждёт проверки');
    expect(HOUSEKEEPING_RU.INSPECTED).toBe('проверено, доступна');
  });
});
