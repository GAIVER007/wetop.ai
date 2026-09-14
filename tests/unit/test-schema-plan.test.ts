import { describe, expect, it } from 'vitest';
import {
  TEST_SCHEMA,
  copyOrder,
  hardcodedLiveAddress,
  pendingMigrations,
  selectExpressions,
} from '../tools/test-schema-plan';

/**
 * Схема pms_test (ADR-042): копия рабочих таблиц, в которую пишут автотесты. Правила построения — чистые функции:
 * какие миграции накатить, в каком порядке копировать таблицы, как привести перечисления, какой спек не пускать.
 */
describe('pendingMigrations', () => {
  it('по порядку имён, без уже применённых', () => {
    expect(
      pendingMigrations(['20260908000002_b', '20260907000001_a', '20260909000003_c'], new Set(['20260907000001_a'])),
    ).toEqual(['20260908000002_b', '20260909000003_c']);
  });
});

describe('copyOrder', () => {
  it('родитель раньше ребёнка, ссылка на себя не мешает, порядок устойчивый', () => {
    const order = copyOrder(
      ['folios', 'reservations', 'reservation_items', 'properties', 'guests'],
      [
        { table: 'reservations', references: 'properties' },
        { table: 'reservations', references: 'guests' },
        { table: 'reservation_items', references: 'reservations' },
        { table: 'folios', references: 'reservation_items' },
        { table: 'guests', references: 'guests' },
      ],
    );
    expect(order.indexOf('properties')).toBeLessThan(order.indexOf('reservations'));
    expect(order.indexOf('guests')).toBeLessThan(order.indexOf('reservations'));
    expect(order.indexOf('reservations')).toBeLessThan(order.indexOf('reservation_items'));
    expect(order.indexOf('reservation_items')).toBeLessThan(order.indexOf('folios'));
    expect(order).toHaveLength(5);
  });
  it('цикл внешних ключей — ошибка, а не молча неполная копия', () => {
    expect(() =>
      copyOrder(['a', 'b'], [
        { table: 'a', references: 'b' },
        { table: 'b', references: 'a' },
      ]),
    ).toThrow(/цикл/);
  });
});

describe('selectExpressions', () => {
  it('перечисление и массив перечислений — через text в тип тестовой схемы; вычисляемые колонки пропускаются', () => {
    const r = selectExpressions(
      [
        { name: 'id', dataType: 'uuid', udtSchema: 'pg_catalog', udtName: 'uuid', generated: false },
        { name: 'status', dataType: 'USER-DEFINED', udtSchema: TEST_SCHEMA, udtName: 'ReservationStatus', generated: false },
        { name: 'kinds', dataType: 'ARRAY', udtSchema: TEST_SCHEMA, udtName: '_Kind', generated: false },
        { name: 'hosts', dataType: 'ARRAY', udtSchema: 'pg_catalog', udtName: '_text', generated: false },
        { name: 'nights', dataType: 'integer', udtSchema: 'pg_catalog', udtName: 'int4', generated: true },
      ],
      TEST_SCHEMA,
    );
    expect(r.insertColumns).toEqual(['"id"', '"status"', '"kinds"', '"hosts"']);
    expect(r.selectList).toEqual([
      '"id"',
      `"status"::text::"${TEST_SCHEMA}"."ReservationStatus"`,
      `"kinds"::text[]::"${TEST_SCHEMA}"."Kind"[]`,
      '"hosts"',
    ]);
  });
});

describe('hardcodedLiveAddress: спек с жёстким адресом рабочего стенда в изолированный прогон не идёт', () => {
  it('жёсткая константа — да; запасное значение после ?? — нет', () => {
    expect(hardcodedLiveAddress("const API = 'http://127.0.0.1:3001';")).toBe(true);
    expect(hardcodedLiveAddress("await page.goto('http://127.0.0.1:3000/today');")).toBe(true);
    expect(hardcodedLiveAddress("const API = process.env.APP_API_URL ?? 'http://127.0.0.1:3001';")).toBe(false);
    expect(hardcodedLiveAddress("await page.goto('/today');")).toBe(false);
  });
});
