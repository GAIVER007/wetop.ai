/**
 * Platform P1 (ADR-104, DATA_MODEL §18; Q-199 — вариант Б): Location — филиал бизнеса, цепочка
 * Organization → Business → Location. Резолвер повторяет устройство property-ref: один рейс в базу
 * на процесс, ключ памяти — организация плюс схема базы (ADR-042), отказ не запоминается (цепочки
 * могло ещё не быть: до применения миграции Platform P1 таблицы пусты, стойка живёт прежним путём).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { forgetLocationRef, organizationLocationRef } from './location-ref';

/** Поддельная база: считает, сколько раз её спросили. Вертикаль отдаётся из связки business (§18.1). */
function fakeDb(
  rows: Array<{
    id: string;
    businessId: string;
    organizationId: string;
    vertical: string;
    name: string;
    timezone: string;
    currency: string;
  }>,
) {
  let calls = 0;
  return {
    calls: () => calls,
    db: {
      location: {
        findFirst: async ({ where }: { where: { business?: { organizationId?: string } } }) => {
          calls += 1;
          const row = rows.find((r) => r.organizationId === where.business?.organizationId);
          if (!row) return null;
          const { organizationId: _org, vertical, ...rest } = row;
          return { ...rest, business: { vertical } };
        },
      },
    },
  };
}

const LUXX = {
  id: 'loc-1',
  businessId: 'biz-1',
  organizationId: 'org-luxx',
  vertical: 'HOSPITALITY',
  name: 'Luxx Aparts',
  timezone: 'Asia/Almaty',
  currency: 'KZT',
};

afterEach(() => {
  forgetLocationRef();
  delete process.env['DATABASE_SCHEMA'];
});

describe('филиал организации через Business (Platform P1)', () => {
  it('второй запрос берётся из памяти: в базу ходим один раз; вертикаль — с Business', async () => {
    const f = fakeDb([LUXX]);
    const db = f.db as never;
    expect((await organizationLocationRef(db, 'org-luxx'))?.id).toBe('loc-1');
    const again = await organizationLocationRef(db, 'org-luxx');
    expect(again?.vertical).toBe('HOSPITALITY');
    expect(again?.businessId).toBe('biz-1');
    expect(f.calls()).toBe(1);
  });

  it('у каждой схемы свой ответ: прогон в pms_test не подсовывает id рабочих данных', async () => {
    const f = fakeDb([LUXX]);
    const db = f.db as never;
    process.env['DATABASE_SCHEMA'] = 'public';
    await organizationLocationRef(db, 'org-luxx');
    process.env['DATABASE_SCHEMA'] = 'pms_test';
    await organizationLocationRef(db, 'org-luxx');
    expect(f.calls()).toBe(2);
  });

  it('память одной организации не отдаётся другой', async () => {
    const f = fakeDb([
      LUXX,
      { ...LUXX, id: 'loc-2', businessId: 'biz-2', organizationId: 'org-b', name: 'Второй' },
    ]);
    const db = f.db as never;
    expect((await organizationLocationRef(db, 'org-luxx'))?.id).toBe('loc-1');
    expect((await organizationLocationRef(db, 'org-b'))?.id).toBe('loc-2');
    expect(f.calls()).toBe(2);
  });

  it('отсутствие цепочки не запоминается: миграция могла ещё не пройти — спросим снова', async () => {
    const rows: Array<typeof LUXX> = [];
    const f = fakeDb(rows);
    const db = f.db as never;
    expect(await organizationLocationRef(db, 'org-luxx')).toBeNull();
    rows.push(LUXX);
    expect((await organizationLocationRef(db, 'org-luxx'))?.id).toBe('loc-1');
    expect(f.calls()).toBe(2);
  });
});
