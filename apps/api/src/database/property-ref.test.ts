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
        findFirst: async ({
          where,
        }: {
          where: { name?: string; organizationId?: string | null };
        }) => {
          calls += 1;
          const row = rows.find(
            (r) =>
              (where.name === undefined || r.name === where.name) &&
              (where.organizationId === undefined ||
                (r.organizationId ?? null) === where.organizationId),
          );
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
 * Разделение данных (ADR-061), теперь как мультитенантность (21.09.2026): вошедший человек получает
 * объект СВОЕЙ организации прямой выборкой по `organizationId`, а не единственный объект по имени.
 * Имя, которое просит репозиторий, для человека не участвует в выборке — поэтому подсунуть чужой
 * объект нельзя по построению. Служебный ходок (скрипт, сторож, импорт, виджет) человека за собой
 * не имеет и берёт объект по имени, как раньше.
 */
describe('вошедший получает объект своей организации, не чужой', () => {
  const two = [
    { id: 'p1', name: 'Luxx', organizationId: 'org-luxx' },
    { id: 'p2', name: 'Второй хостел', organizationId: 'org-b' },
  ];

  it('служебный ходок проходит по имени: за ним нет человека — скрипт, сторож, импорт', async () => {
    const db = fakeDb(two).db as never;
    expect(await propertyIdRef(db, 'Luxx')).toBe('p1');
    expect(await propertyIdRef(db, 'Второй хостел')).toBe('p2');
  });

  it('вошедший получает объект своей организации, даже когда репозиторий просит по чужому имени', async () => {
    const db = fakeDb(two).db as never;
    // org-luxx просит «Второй хостел», org-b просит «Luxx» — каждый получает СВОЙ объект, не тот, что назвал
    await withSignedInUser({ userId: 'u-1', organizationId: 'org-luxx' }, async () => {
      expect(await propertyIdRef(db, 'Второй хостел')).toBe('p1');
    });
    await withSignedInUser({ userId: 'u-2', organizationId: 'org-b' }, async () => {
      expect(await propertyIdRef(db, 'Luxx')).toBe('p2');
    });
  });

  it('память одной организации не отдаётся другой', async () => {
    const f = fakeDb(two);
    const db = f.db as never;
    await withSignedInUser({ userId: 'u-1', organizationId: 'org-luxx' }, async () => {
      expect(await propertyIdRef(db, 'Luxx')).toBe('p1');
      expect(await propertyIdRef(db, 'Luxx')).toBe('p1'); // из памяти
    });
    await withSignedInUser({ userId: 'u-2', organizationId: 'org-b' }, async () => {
      expect(await propertyIdRef(db, 'Luxx')).toBe('p2'); // своя память, не org-luxx
    });
    expect(f.calls(), 'по одному рейсу на организацию').toBe(2);
  });

  it('у чьей организации ещё нет объекта — «создайте в настройках», а не чужой объект', async () => {
    const db = fakeDb(two).db as never;
    await withSignedInUser({ userId: 'u-3', organizationId: 'org-novaya' }, async () => {
      await expect(propertyIdRef(db, 'Luxx')).rejects.toThrow(/ещё нет объекта/);
    });
  });

  it('вошедший без организации (нет членства) не видит ни одного объекта', async () => {
    const db = fakeDb(two).db as never;
    await withSignedInUser({ userId: 'u-4', organizationId: null }, async () => {
      await expect(propertyIdRef(db, 'Luxx')).rejects.toThrow(/не настроен для вашей организации/);
    });
  });
});

/**
 * Аудит 26.09, С-2: служебный контекст (webhook Channex, публичный виджет, сторож, импорт) выбирал объект по имени без
 * порядка, а имя не уникально — регистрация создаёт объект с названием, введённым человеком. База без ORDER BY отдаёт
 * строки в любом порядке, и одноимённая организация могла подменить объект. Берётся самый ранний: так выбор не зависит
 * от порядка строк, а подменить его регистрацией позже нельзя.
 */
describe('служебный контекст и одноимённые объекты', () => {
  it('из двух объектов с одним именем берётся заведённый раньше, в каком бы порядке их ни отдала база', async () => {
    const rows = [
      { id: 'чужой', name: 'Luxx', organizationId: 'org-b', createdAt: new Date('2026-09-25') },
      { id: 'настоящий', name: 'Luxx', organizationId: 'org-a', createdAt: new Date('2026-09-01') },
    ];
    const db = {
      property: {
        findFirst: async ({
          where,
          orderBy,
        }: {
          where: { name?: string };
          orderBy?: { createdAt?: 'asc' | 'desc' };
        }) => {
          const hit = rows.filter((r) => r.name === where.name);
          if (orderBy?.createdAt === 'asc')
            hit.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          return hit[0] ? { id: hit[0].id, name: hit[0].name, organizationId: hit[0].organizationId } : null;
        },
      },
    };
    expect(await propertyIdRef(db as never, 'Luxx')).toBe('настоящий');
  });
});
