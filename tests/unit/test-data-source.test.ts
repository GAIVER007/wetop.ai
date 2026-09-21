import { describe, expect, it } from 'vitest';
import { chooseTestDataSource, refreshPlan, seedIsStale } from '../tools/test-schema-plan';

/** Выбор источника данных для pms_test (plans/tests-without-live-db-2026-09-15.md, шаг 2) */
describe('chooseTestDataSource', () => {
  it('без переменной: копия, если рабочая схема с данными, иначе сид', () => {
    expect(chooseTestDataSource(undefined, true)).toBe('copy');
    expect(chooseTestDataSource('', true)).toBe('copy');
    expect(chooseTestDataSource(undefined, false)).toBe('seed');
  });
  it('переменная побеждает состояние базы', () => {
    expect(chooseTestDataSource('seed', true)).toBe('seed');
    expect(chooseTestDataSource('copy', false)).toBe('copy');
  });
  it('незнакомое значение — ошибка, не умолчание', () => {
    expect(() => chooseTestDataSource('live', true)).toThrow(/TEST_DATA=live/);
  });
});

/**
 * Сид держит занятость вокруг «сегодня» (−10…+2 ночей, `tests/tools/test-seed.ts`), а с +3 начинаются
 * окна спеков. Сид, засеянный позавчера, к сегодняшнему дню пуст: 19.09.2026 `chessboard.spec` увидел
 * занято 0 на сиде от 16.09. Значит, сид старше сегодняшнего дня надо засеять заново, а не копию считать
 * свежей: у копии рабочих данных даты настоящие, и её день не важен.
 */
describe('seedIsStale', () => {
  it('сид не с сегодняшнего дня (по Алматы) — устарел', () => {
    expect(seedIsStale('2026-09-16T20:30:00.000Z (сид)', '2026-09-19')).toBe(true);
    // 21:30 UTC 18.09 — это уже 02:30 19.09 по Алмати: сид сегодняшний
    expect(seedIsStale('2026-09-18T21:30:00.000Z (сид)', '2026-09-19')).toBe(false);
    expect(seedIsStale('2026-09-19T05:00:00.000Z (сид)', '2026-09-19')).toBe(false);
  });
  it('копия рабочих данных не стареет, как и отсутствие отметки', () => {
    expect(seedIsStale('2026-09-10T10:00:00.000Z', '2026-09-19')).toBe(false);
    expect(seedIsStale(null, '2026-09-19')).toBe(false);
  });
});

/**
 * Пересев поверх прежнего сида. 20.09.2026 сквозной прогон встал ещё до первого спека: сид от 19.09
 * устарел, `ensureTestSchema` засеял заново — и импорт упёрся в «сид построен с пересечениями: 1».
 * Причина: сид кладёт те же брони на сдвинутые даты, и пока часть строк ещё вчерашняя, новая дата
 * налезает на соседнюю ячейку. Значит, пересев по непустой схеме обязан сначала снять прежние данные;
 * первый засев по пустой схеме чистить нечего, а копия рабочих данных чистит за собой сама.
 */
describe('refreshPlan', () => {
  it('пустая схема — засеять, чистить нечего', () => {
    expect(refreshPlan({ empty: true, stale: false, refresh: false })).toEqual({
      refill: true,
      wipeFirst: false,
    });
  });
  it('устаревший сид — засеять заново и сперва снять прежние данные', () => {
    expect(refreshPlan({ empty: false, stale: true, refresh: false })).toEqual({
      refill: true,
      wipeFirst: true,
    });
  });
  it('явное обновление по непустой схеме — тоже с очисткой', () => {
    expect(refreshPlan({ empty: false, stale: false, refresh: true })).toEqual({
      refill: true,
      wipeFirst: true,
    });
  });
  it('свежий сид на месте — не трогаем вовсе', () => {
    expect(refreshPlan({ empty: false, stale: false, refresh: false })).toEqual({
      refill: false,
      wipeFirst: false,
    });
  });
});
