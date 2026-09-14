import { describe, expect, it } from 'vitest';
import { memoPropertyId } from './property-id';

/**
 * Скорость (волна 4): репозитории искали объект по имени на каждый запрос — ещё одно обращение к базе в Сингапуре
 * (~0,35 с) к каждой странице. id объекта за жизнь процесса не меняется.
 */
describe('memoPropertyId', () => {
  it('ищет объект один раз на экземпляр репозитория', async () => {
    let calls = 0;
    const propertyId = memoPropertyId(async () => {
      calls += 1;
      return { id: 'p1' };
    });
    expect(await Promise.all([propertyId(), propertyId()])).toEqual(['p1', 'p1']);
    expect(await propertyId()).toBe('p1');
    expect(calls).toBe(1);
  });

  it('сбой не запоминается: следующий запрос ищет заново', async () => {
    let calls = 0;
    const propertyId = memoPropertyId(async () => {
      calls += 1;
      if (calls === 1) throw new Error('Connection terminated unexpectedly');
      return { id: 'p1' };
    });
    await expect(propertyId()).rejects.toThrow('Connection terminated');
    expect(await propertyId()).toBe('p1');
    expect(calls).toBe(2);
  });
});
