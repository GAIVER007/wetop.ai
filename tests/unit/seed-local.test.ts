import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  isLocalDatabase,
  LOCAL_PROPERTY,
  STAND_LIVING_UNITS,
  STAND_PAST,
  unitPlan,
} from '../tools/seed-local';
import { OWN_NUMBER } from '../../scripts/reconciliation/src/e2e-cleanup-rules';

/**
 * Засев локального стенда обязан отказаться от чужой базы: тот же скрипт с dev-адресом в переменной
 * окружения создал бы объект и единицы в Сингапуре, где живут настоящие брони (SECURITY.md §3).
 */
describe('seed-local: только локальная база', () => {
  it('localhost и 127.0.0.1 — можно', () => {
    expect(isLocalDatabase('postgresql://postgres@127.0.0.1:55432/pmslocal')).toBe(true);
    expect(isLocalDatabase('postgresql://postgres@localhost:55432/pmslocal')).toBe(true);
  });

  it('dev-БД, боевая и мусор — нельзя', () => {
    expect(isLocalDatabase('postgresql://u:p@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres')).toBe(false);
    expect(isLocalDatabase('postgresql://u:p@db.example.kz:5432/pms')).toBe(false);
    expect(isLocalDatabase('')).toBe(false);
    expect(isLocalDatabase('не адрес')).toBe(false);
    // хост, который лишь начинается как локальный, локальным не считается
    expect(isLocalDatabase('postgresql://u@localhost.attacker.example/pms')).toBe(false);
  });

  it('объект стенда — пустая коробка с рабочим именем, без данных гостей', () => {
    expect(LOCAL_PROPERTY.address).toBe('нигде');
    expect(LOCAL_PROPERTY.timezone).toBe('Asia/Almaty');
  });
});

/**
 * Форма стенда = форма объекта (OBJECT.md §6, CLAUDE.md §6): 88 единиц, 16 номеров и 72 койки,
 * пять категорий по 4 / 8 / 4 / 36 / 36, отрезки номеров как в Legacy. Сквозные подбирали окна дат
 * под 36 коек в категории — на 24 (три категории по 24 до 18.09) места кончались (TESTING.md §3).
 */
describe('seed-local: стенд повторяет форму объекта', () => {
  it('88 единиц: 16 номеров и 72 койки, отрезки номеров как у объекта', () => {
    const plan = unitPlan();
    expect(plan).toHaveLength(88);
    expect(plan.filter((u) => u.kind === 'ROOM')).toHaveLength(16);
    expect(plan.filter((u) => u.kind === 'BED')).toHaveLength(72);
    const byNumber = new Map(plan.map((u) => [Number(u.number), u]));
    for (const n of [1, 2, 3, 4, 41, 48, 85, 88]) expect(byNumber.get(n)?.kind).toBe('ROOM');
    for (const n of [5, 40, 49, 84]) expect(byNumber.get(n)?.kind).toBe('BED');
  });
  it('пять категорий: 4 / 8 / 4 номера и 36 / 36 коек', () => {
    const plan = unitPlan();
    const count = (code: string) => plan.filter((u) => u.category === code).length;
    expect(CATEGORIES.map((c) => `${c.code}:${count(c.code)}`)).toEqual([
      'L-WINDOW:4',
      'L-INNER:8',
      'L-DOUBLE:4',
      'L-MALE:36',
      'L-FEMALE:36',
    ]);
  });
  it('заселённые проживания стенда уборка автотестов не трогает и в будущие окна спеков не лезет', () => {
    for (let i = 1; i <= STAND_PAST.units.length + STAND_LIVING_UNITS.length; i++)
      expect(OWN_NUMBER.test(`STAND-${String(i).padStart(4, '0')}`)).toBe(false);
    // прошлые — покрывают дату, зашитую в chessboard.spec.ts
    expect(STAND_PAST.from <= '2026-09-08' && STAND_PAST.to > '2026-09-08').toBe(true);
    // живущие — по одному на категорию коек и номеров, выезд не позже «сегодня + 2»: окна спеков с +4
    expect(STAND_LIVING_UNITS).toHaveLength(4);
  });
});
