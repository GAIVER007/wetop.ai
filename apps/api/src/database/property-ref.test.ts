/**
 * Объект спрашивали у базы в каждом запросе: `property.findFirst({ where: { name } })` стоит в девяти
 * репозиториях, а дашборд платит этот рейс восемь раз за один запрос (2 периода × 4 выборки).
 * База в Сингапуре, стойка в Алматы — каждый лишний рейс это десятки миллисекунд на пустом месте.
 * Объект один и не переименовывается на ходу, поэтому id держим в памяти процесса.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { withSignedInUser } from '../auth/request-context';
import { forgetPropertyRef, propertyIdRef } from './property-ref';

/** Поддельная база: считает, сколько раз её спросили */
function fakeDb(rows: Array<{ id: string; name: string; organizationId?: string | null }>) {
  let calls = 0;
  return {
    calls: () => calls,
    db: {
      property: {
        findFirst: async ({ where }: { where: { name: string } }) => {
          calls += 1;
          const row = rows.find((r) => r.name === where.name);
          return row ? { organizationId: null, ...row } : null;
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

/**
 * Разделение данных (ADR-061). Это тот самый замок, которого не было до 20.09.2026: вошедший видел
 * единственный объект, кем бы он ни был, и самостоятельно зарегистрировавшийся попадал в чужую
 * гостиницу. Проверка стоит здесь, потому что здесь имя объекта превращается в идентификатор —
 * дальше по нему ходят и шахматка, и брони, и тарифы.
 */
describe('объект виден только своей организации', () => {
  const luxx = [{ id: 'p1', name: 'Luxx', organizationId: 'org-luxx' }];

  it('служебный ходок проходит: за ним нет человека — это скрипт владельца, сторож, импорт', async () => {
    const db = fakeDb(luxx).db as never;
    expect(await propertyIdRef(db, 'Luxx')).toBe('p1');
  });

  it('вошедший своей организации проходит', async () => {
    const db = fakeDb(luxx).db as never;
    await withSignedInUser({ userId: 'u-1', organizationId: 'org-luxx' }, async () => {
      expect(await propertyIdRef(db, 'Luxx')).toBe('p1');
    });
  });

  it('вошедший чужой организации получает отказ, а не чужую гостиницу', async () => {
    const db = fakeDb(luxx).db as never;
    await withSignedInUser({ userId: 'u-2', organizationId: 'org-novaya' }, async () => {
      await expect(propertyIdRef(db, 'Luxx')).rejects.toThrow(/не настроен для вашей организации/);
    });
  });

  it('объект без организации вошедшему не виден: ничей объект — дело служебных ходоков', async () => {
    const db = fakeDb([{ id: 'p1', name: 'Luxx', organizationId: null }]).db as never;
    await withSignedInUser({ userId: 'u-1', organizationId: 'org-luxx' }, async () => {
      await expect(propertyIdRef(db, 'Luxx')).rejects.toThrow(/не настроен для вашей организации/);
    });
  });

  it('вошедший без организации не проходит даже после того, как объект попал в память', async () => {
    const f = fakeDb(luxx);
    const db = f.db as never;
    await withSignedInUser({ userId: 'u-1', organizationId: 'org-luxx' }, async () => {
      expect(await propertyIdRef(db, 'Luxx')).toBe('p1');
    });
    // память отвечает без рейса в базу — но замок стоит и на этом пути
    await withSignedInUser({ userId: 'u-3', organizationId: null }, async () => {
      await expect(propertyIdRef(db, 'Luxx')).rejects.toThrow(/не настроен для вашей организации/);
    });
    expect(f.calls(), 'второго рейса в базу отказ не стоил').toBe(1);
  });
});
