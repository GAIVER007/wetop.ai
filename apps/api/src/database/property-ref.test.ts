/**
 * Объект спрашивали у базы в каждом запросе: `property.findFirst({ where: { name } })` стоит в девяти
 * репозиториях, а дашборд платит этот рейс восемь раз за один запрос (2 периода × 4 выборки).
 * База в Сингапуре, стойка в Алматы — каждый лишний рейс это десятки миллисекунд на пустом месте.
 * Объект один и не переименовывается на ходу, поэтому id держим в памяти процесса.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withOrganizationScope, withSignedInUser } from '../auth/request-context';
import { forgetPropertyRef, propertyIdRef } from './property-ref';

/**
 * Поддельная база: считает, сколько раз её спросили. `chainOrganizationId` — чья цепочка
 * Location → Business у объекта (Platform P1, ADR-104).
 */
function fakeDb(
  rows: Array<{
    id: string;
    name: string;
    organizationId?: string | null;
    chainOrganizationId?: string;
    businessId?: string;
    locationId?: string;
  }>,
) {
  let calls = 0;
  return {
    calls: () => calls,
    db: {
      property: {
        findFirst: async ({
          where,
        }: {
          where: {
            name?: string;
            organizationId?: string | null;
            locationId?: string;
            location?: { businessId?: string; business?: { organizationId?: string } };
          };
        }) => {
          calls += 1;
          const row = rows.find(
            (r) =>
              (where.name === undefined || r.name === where.name) &&
              (where.organizationId === undefined ||
                (r.organizationId ?? null) === where.organizationId) &&
              (where.location === undefined ||
                r.chainOrganizationId === where.location.business?.organizationId) &&
              (where.locationId === undefined || r.locationId === where.locationId) &&
              (where.location?.businessId === undefined || r.businessId === where.location.businessId),
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
    { id: 'p1', name: 'Luxx', organizationId: 'org-luxx', chainOrganizationId: 'org-luxx' },
    { id: 'p2', name: 'Второй хостел', organizationId: 'org-b', chainOrganizationId: 'org-b' },
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
    expect(f.calls(), 'по одному рейсу на организацию, из памяти — ноль').toBe(2);
  });

  it('у чьей организации ещё нет объекта — «создайте в настройках», а не чужой объект', async () => {
    const db = fakeDb(two).db as never;
    await withSignedInUser({ userId: 'u-3', organizationId: 'org-novaya' }, async () => {
      await expect(propertyIdRef(db, 'Luxx')).rejects.toThrow(/ещё нет объекта/);
    });
  });

  /**
   * Публичный путь сайта (виджет брони, котировка продавца) человека за собой не имеет, но действует от имени организации
   * своего сайта (план tenant-isolation-2026-09-26 п. 4): раньше он брал объект Luxx по имени, и сайт другой гостиницы
   * продавал бы номера Luxx.
   */
  it('путь от имени организации без человека получает объект этой организации, а не объект по имени', async () => {
    const db = fakeDb(two).db as never;
    await withOrganizationScope('org-b', async () => {
      expect(await propertyIdRef(db, 'Luxx')).toBe('p2');
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

/**
 * Platform P1 (ADR-104 §18, Q-199 вариант Б): объект организации находится ТОЛЬКО по цепочке
 * Organization → Business → Location → Property. Фолбэк по properties.organization_id был миграционным
 * окном и снят после production backfill (broken_chain = 0, 28.09.2026; DATA_MODEL v2.6).
 */
describe('Platform P1: объект организации только через цепочку Business → Location', () => {
  it('когда цепочка привязана — объект берётся через неё, а не по organizationId', async () => {
    const db = fakeDb([
      { id: 'старый-путь', name: 'Luxx', organizationId: 'org-luxx' },
      { id: 'через-цепочку', name: 'Luxx', organizationId: 'org-someone-else', chainOrganizationId: 'org-luxx' },
    ]).db as never;
    await withSignedInUser({ userId: 'u-1', organizationId: 'org-luxx' }, async () => {
      expect(await propertyIdRef(db, 'Luxx')).toBe('через-цепочку');
    });
  });

  it('объект без цепочки (только properties.organization_id) не находится: обходного пути нет, один рейс', async () => {
    const f = fakeDb([{ id: 'p1', name: 'Luxx', organizationId: 'org-luxx' }]);
    const db = f.db as never;
    await withSignedInUser({ userId: 'u-1', organizationId: 'org-luxx' }, async () => {
      await expect(propertyIdRef(db, 'Luxx')).rejects.toThrow(/ещё нет объекта/);
    });
    expect(f.calls()).toBe(1);
  });
});

/**
 * Platform P2, К1 (план P2 §4а, ADR-120): объект открывается по scope запроса. ORGANIZATION — как раньше, самый ранний
 * объект цепочки; BUSINESS — самый ранний объект этого Business; LOCATION — объект этого филиала. Scope приходит уже
 * проверенным (`auth/scope.ts`); здесь только выбор и память по scope.
 */
describe('Platform P2, К1: объект по scope запроса', () => {
  const rows = [
    { id: 'p-first', name: 'Первый', organizationId: 'org-a', chainOrganizationId: 'org-a', businessId: 'b-1', locationId: 'l-1' },
    { id: 'p-second', name: 'Второй', organizationId: 'org-a', chainOrganizationId: 'org-a', businessId: 'b-2', locationId: 'l-2' },
    { id: 'p-third', name: 'Третий', organizationId: 'org-a', chainOrganizationId: 'org-a', businessId: 'b-2', locationId: 'l-3' },
  ];
  const as = (scope: Record<string, string>) => ({ userId: 'u-1', organizationId: 'org-a', ...scope });

  it('ORGANIZATION — самый ранний объект организации, как до P2', async () => {
    const db = fakeDb(rows).db as never;
    await withSignedInUser(as({ scope: 'ORGANIZATION' }) as never, async () => {
      expect(await propertyIdRef(db, 'Luxx')).toBe('p-first');
    });
  });

  it('BUSINESS — самый ранний объект этого Business', async () => {
    const db = fakeDb(rows).db as never;
    await withSignedInUser(as({ scope: 'BUSINESS', businessId: 'b-2' }) as never, async () => {
      expect(await propertyIdRef(db, 'Luxx')).toBe('p-second');
    });
  });

  it('LOCATION — объект этого филиала', async () => {
    const db = fakeDb(rows).db as never;
    await withSignedInUser(as({ scope: 'LOCATION', businessId: 'b-2', locationId: 'l-3' }) as never, async () => {
      expect(await propertyIdRef(db, 'Luxx')).toBe('p-third');
    });
  });

  it('память — по scope: переключение не отдаёт объект прежнего scope', async () => {
    const f = fakeDb(rows);
    const db = f.db as never;
    await withSignedInUser(as({ scope: 'ORGANIZATION' }) as never, async () => {
      expect(await propertyIdRef(db, 'Luxx')).toBe('p-first');
    });
    await withSignedInUser(as({ scope: 'LOCATION', businessId: 'b-2', locationId: 'l-3' }) as never, async () => {
      expect(await propertyIdRef(db, 'Luxx')).toBe('p-third');
    });
    await withSignedInUser(as({ scope: 'ORGANIZATION' }) as never, async () => {
      expect(await propertyIdRef(db, 'Luxx')).toBe('p-first');
    });
    expect(f.calls(), 'по рейсу на scope, повтор — из памяти').toBe(2);
  });
});

/**
 * SEC-2 (аудит 29.09.2026): служебный ходок (сторож, фоновые циклы, скрипты) брал объект по названию — самому раннему с
 * этим именем. `INTEGRATION_PROPERTY_ID` задаёт объект установки явно: название на выбор больше не влияет.
 */
describe('служебный путь: INTEGRATION_PROPERTY_ID', () => {
  const ID = '67646baa-d066-4977-8afc-67f48398842f';
  afterEach(() => vi.unstubAllEnvs());

  function idDb(found: { id: string; name: string; organizationId: string | null; timezone: string } | null) {
    const findUnique = vi.fn(async () => found);
    const findFirst = vi.fn(async () => ({ id: 'p-namesake', name: 'Luxx', organizationId: null, timezone: 'Asia/Almaty' }));
    return { findUnique, findFirst, db: { property: { findUnique, findFirst } } as never };
  }

  it('идентификатор задан — объект по нему, а не по названию', async () => {
    vi.stubEnv('INTEGRATION_PROPERTY_ID', ID);
    const f = idDb({ id: ID, name: 'Другое имя', organizationId: 'org-luxx', timezone: 'Asia/Almaty' });
    expect(await propertyIdRef(f.db, 'Luxx')).toBe(ID);
    expect(f.findFirst).not.toHaveBeenCalled();
    // второй раз — из памяти
    expect(await propertyIdRef(f.db, 'Luxx')).toBe(ID);
    expect(f.findUnique).toHaveBeenCalledTimes(1);
  });

  it('идентификатор задан, объекта нет — понятная ошибка, к названию не откатываемся', async () => {
    vi.stubEnv('INTEGRATION_PROPERTY_ID', ID);
    const f = idDb(null);
    await expect(propertyIdRef(f.db, 'Luxx')).rejects.toThrow(/INTEGRATION_PROPERTY_ID/);
    expect(f.findFirst).not.toHaveBeenCalled();
  });

  it('идентификатор не UUID — понятная ошибка, в базу не ходим', async () => {
    vi.stubEnv('INTEGRATION_PROPERTY_ID', 'luxx');
    const f = idDb(null);
    await expect(propertyIdRef(f.db, 'Luxx')).rejects.toThrow(/INTEGRATION_PROPERTY_ID/);
    expect(f.findUnique).not.toHaveBeenCalled();
    expect(f.findFirst).not.toHaveBeenCalled();
  });

  it('идентификатора нет — прежний путь по названию', async () => {
    vi.stubEnv('INTEGRATION_PROPERTY_ID', '');
    const f = idDb(null);
    expect(await propertyIdRef(f.db, 'Luxx')).toBe('p-namesake');
    expect(f.findUnique).not.toHaveBeenCalled();
  });
});
