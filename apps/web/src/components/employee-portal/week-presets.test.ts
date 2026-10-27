import { describe, expect, it } from 'vitest';
import { applyWeekPreset, weekProblem, WEEK_PRESETS } from './week-presets';

// Онбординг на живом сайте 21.10.2026: у нового мастера все 7 дней «Выходной», чтобы задать обычную неделю,
// нужно 14 раз выбрать время. Быстрые шаблоны заполняют неделю одним нажатием, дальше можно поправить день.
const empty = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, intervals: [] as Array<{ timeFrom: string; timeTo: string }> }));
describe('applyWeekPreset', () => {
  it('«Пн-Пт 10:00-19:00»: будни заняты, выходные пустые, порядок дней сохранён', () => {
    const next = applyWeekPreset(empty, WEEK_PRESETS[0]!);
    expect(next.map((d) => d.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(next.filter((d) => d.intervals.length).map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5]);
    expect(next[1]!.intervals).toEqual([{ timeFrom: '10:00', timeTo: '19:00' }]);
    expect(next[0]!.intervals).toEqual([]);
  });
  it('шаблоны: будни, без воскресенья, каждый день; подписи по-русски', () => {
    expect(WEEK_PRESETS.map((p) => p.label)).toEqual(['Пн-Пт 10:00-19:00', 'Пн-Сб 10:00-20:00', 'Каждый день 09:00-21:00', 'Каждый день 10:00-24:00']);
    expect(applyWeekPreset(empty, WEEK_PRESETS[1]!).filter((d) => d.intervals.length)).toHaveLength(6);
    expect(applyWeekPreset(empty, WEEK_PRESETS[2]!).filter((d) => d.intervals.length)).toHaveLength(7);
  });
  it('шаблон заменяет прежние часы, а не дописывает', () => {
    const filled = empty.map((d) => ({ ...d, intervals: [{ timeFrom: '08:00', timeTo: '12:00' }, { timeFrom: '13:00', timeTo: '17:00' }] }));
    expect(applyWeekPreset(filled, WEEK_PRESETS[0]!)[2]!.intervals).toEqual([{ timeFrom: '10:00', timeTo: '19:00' }]);
    expect(applyWeekPreset(filled, WEEK_PRESETS[0]!)[6]!.intervals).toEqual([]);
  });
});

// Живой сайт 21.10.2026 (аудит, п. 2): пустое время давало подсказку браузера по-английски «Please fill out this field.»
describe('weekProblem', () => {
  const day = (weekday: number, timeFrom: string, timeTo: string) => ({ weekday, intervals: [{ timeFrom, timeTo }] });
  it('пустое время: своя подсказка по-русски с названием дня', () => {
    expect(weekProblem([day(1, '', '')])).toBe('Понедельник: укажите время начала и конца, например 09:00 и 18:00');
    expect(weekProblem([day(0, '10:00', '')])).toBe('Воскресенье: укажите время начала и конца, например 09:00 и 18:00');
  });
  it('конец раньше начала: та же проверка, что на сервере', () => {
    expect(weekProblem([day(2, '18:00', '09:00')])).toBe('Конец рабочего времени должен быть позже начала');
  });
  it('верная неделя и пустая неделя проходят', () => {
    expect(weekProblem([day(1, '09:00', '18:00')])).toBeNull();
    expect(weekProblem([{ weekday: 3, intervals: [] }])).toBeNull();
  });
});

describe('смена до полуночи (владелец 27.10.2026: «с 10:00 до 24:00»)', () => {
  it('шаблон «Каждый день 10:00-24:00» проходит проверку недели', () => {
    const week = applyWeekPreset(empty, WEEK_PRESETS[3]!);
    expect(week[2]!.intervals).toEqual([{ timeFrom: '10:00', timeTo: '24:00' }]);
    expect(weekProblem(week)).toBeNull();
  });
});
