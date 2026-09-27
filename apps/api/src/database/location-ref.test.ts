/**
 * Phase 2 (ADR-100 §17.1, DATA_MODEL v2.2 §17.6): Location — точка бизнеса организации.
 * Резолвер повторяет устройство property-ref: один рейс в базу на процесс, ключ памяти —
 * организация плюс схема базы (ADR-042), отказ не запоминается (Location могла ещё не появиться:
 * до применения миграции Phase 2 таблица пуста, и стойка живёт прежним путём по properties).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { forgetLocationRef, organizationLocationRef } from './location-ref';

/** Поддельная база: считает, сколько раз её спросили */
function fakeDb(rows: Array<{ id: string; organizationId: string; vertical: string; name: string; timezone: string; currency: string }>) {
  let calls = 0;
  return {
    calls: () => calls,
    db: {
      location: {
        findFirst: async ({ where }: { where: { organizationId?: string } }) => {
          calls += 1;
          return rows.find((r) => r.organizationId === where.organizationId) ?? null;
        },
      },
    },
  };
}

const LUXX = {
  id: 'loc-1',
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

describe('Location организации (Phase 2)', () => {
  it('второй запрос берётся из памяти: в базу ходим один раз', async () => {
    const f = fakeDb([LUXX]);
    const db = f.db as never;
    expect((await organizationLocationRef(db, 'org-luxx'))?.id).toBe('loc-1');
    expect((await organizationLocationRef(db, 'org-luxx'))?.vertical).toBe('HOSPITALITY');
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
    const f = fakeDb([LUXX, { ...LUXX, id: 'loc-2', organizationId: 'org-b', name: 'Второй' }]);
    const db = f.db as never;
    expect((await organizationLocationRef(db, 'org-luxx'))?.id).toBe('loc-1');
    expect((await organizationLocationRef(db, 'org-b'))?.id).toBe('loc-2');
    expect(f.calls()).toBe(2);
  });

  it('отсутствие Location не запоминается: миграция могла ещё не пройти — спросим снова', async () => {
    const rows: Array<typeof LUXX> = [];
    const f = fakeDb(rows);
    const db = f.db as never;
    expect(await organizationLocationRef(db, 'org-luxx')).toBeNull();
    rows.push(LUXX);
    expect((await organizationLocationRef(db, 'org-luxx'))?.id).toBe('loc-1');
    expect(f.calls()).toBe(2);
  });
});
