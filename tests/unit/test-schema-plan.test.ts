import { describe, expect, it } from 'vitest';
import {
  TEST_SCHEMA,
  copyOrder,
  copyPlan,
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
  it('цикл через колонку, допускающую NULL (сайт ↔ версия, MKT3): ребро разрывается и называется', () => {
    const plan = copyPlan(
      ['marketing_sites', 'marketing_site_versions', 'locations'],
      [
        { table: 'marketing_sites', references: 'locations', nullable: false },
        { table: 'marketing_sites', references: 'marketing_site_versions', nullable: true },
        { table: 'marketing_site_versions', references: 'marketing_sites', nullable: false },
        { table: 'marketing_site_versions', references: 'marketing_site_versions', nullable: true },
      ],
    );
    expect(plan.order.indexOf('locations')).toBeLessThan(plan.order.indexOf('marketing_sites'));
    expect(plan.order.indexOf('marketing_sites')).toBeLessThan(plan.order.indexOf('marketing_site_versions'));
    expect(plan.relaxed).toEqual([{ table: 'marketing_sites', references: 'marketing_site_versions' }]);
  });
  it('без цикла ничего не разрывается, даже если ссылка допускает NULL', () => {
    const plan = copyPlan(['a', 'b'], [{ table: 'b', references: 'a', nullable: true }]);
    expect(plan).toEqual({ order: ['a', 'b'], relaxed: [] });
  });
  it('цикл через обязательные ссылки остаётся ошибкой', () => {
    expect(() =>
      copyPlan(['a', 'b'], [
        { table: 'a', references: 'b', nullable: false },
        { table: 'b', references: 'a', nullable: true },
      ]),
    ).not.toThrow();
    expect(() =>
      copyPlan(['a', 'b'], [
        { table: 'a', references: 'b', nullable: false },
        { table: 'b', references: 'a', nullable: false },
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
