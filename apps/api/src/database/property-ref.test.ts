/**
 * Объект спрашивали у базы в каждом запросе: `property.findFirst({ where: { name } })` стоит в девяти
 * репозиториях, а дашборд платит этот рейс восемь раз за один запрос (2 периода × 4 выборки).
 * База в Сингапуре, стойка в Алматы — каждый лишний рейс это десятки миллисекунд на пустом месте.
 * Объект один и не переименовывается на ходу, поэтому id держим в памяти процесса.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { forgetPropertyRef, propertyIdRef } from './property-ref';

/** Поддельная база: считает, сколько раз её спросили */
function fakeDb(rows: Array<{ id: string; name: string }>) {
  let calls = 0;
  return {
    calls: () => calls,
    db: {
      property: {
        findFirst: async ({ where }: { where: { name: string } }) => {
          calls += 1;
          return rows.find((r) => r.name === where.name) ?? null;
        },
      },
    },
  };
}

afterEach(() => {
  forgetPropertyRef();
  delete process.env['DATABASE_SCHEMA'];
});

describe('идентификатор объекта', () => {
  it('второй запрос берётся из памяти: в базу ходим один раз', async () => {
    const f = fakeDb([{ id: 'p1', name: 'Luxx' }]);
    const db = f.db as never;
    expect(await propertyIdRef(db, 'Luxx')).toBe('p1');
    expect(await propertyIdRef(db, 'Luxx')).toBe('p1');
    expect(await propertyIdRef(db, 'Luxx')).toBe('p1');
    expect(f.calls()).toBe(1);
  });

  it('у каждой схемы свой ответ: прогон в pms_test не подсовывает id рабочих данных', async () => {
    const f = fakeDb([{ id: 'p1', name: 'Luxx' }]);
    const db = f.db as never;
    process.env['DATABASE_SCHEMA'] = 'public';
    await propertyIdRef(db, 'Luxx');
    process.env['DATABASE_SCHEMA'] = 'pms_test';
    await propertyIdRef(db, 'Luxx');
    expect(f.calls()).toBe(2);
  });

  it('разные объекты не путаются (пригодится, когда объектов станет много)', async () => {
    const f = fakeDb([
      { id: 'p1', name: 'Luxx' },
      { id: 'p2', name: 'Второй' },
    ]);
    const db = f.db as never;
    expect(await propertyIdRef(db, 'Luxx')).toBe('p1');
    expect(await propertyIdRef(db, 'Второй')).toBe('p2');
    expect(f.calls()).toBe(2);
  });

  it('отказ не запоминается: база ещё не настроена — спросим снова', async () => {
    const rows: Array<{ id: string; name: string }> = [];
    const f = fakeDb(rows);
    const db = f.db as never;
    await expect(propertyIdRef(db, 'Luxx')).rejects.toThrow(/не найден/);
    rows.push({ id: 'p1', name: 'Luxx' });
    expect(await propertyIdRef(db, 'Luxx')).toBe('p1');
    expect(f.calls()).toBe(2);
  });
});
