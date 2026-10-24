import { describe, expect, it } from 'vitest';
import { hotelMonthLine, hotelTaskDue, hotelUnitNote } from './hotel-cabinet';

describe('кабинет горничной: подписи словами', () => {
  it('«Мой месяц» одной строкой, с падежами', () => {
    expect(hotelMonthLine({ month: '2026-10', cleanings: 12, tasksDone: 1, shifts: 21, daysOff: 10 }, '2026')).toBe(
      'Октябрь: 12 уборок, 1 задача, 21 смена, 10 выходных',
    );
    expect(hotelMonthLine({ month: '2025-12', cleanings: 2, tasksDone: 0, shifts: 0, daysOff: 31 }, '2026')).toBe(
      'Декабрь 2025: 2 уборки, 0 задач, 0 смен, 31 выходной',
    );
  });
  it('срок задачи без ISO-даты', () => {
    expect(hotelTaskDue({ dueDate: '2026-10-22', dueTime: '14:00', overdue: false, done: false }, '2026-10-22')).toBe('сегодня, 14:00');
    expect(hotelTaskDue({ dueDate: '2026-10-22', dueTime: null, overdue: false, done: false }, '2026-10-22')).toBe('сегодня, весь день');
    const late = hotelTaskDue({ dueDate: '2026-10-20', dueTime: null, overdue: true, done: false }, '2026-10-22');
    expect(late).toMatch(/^просрочена с 20/);
    expect(late).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(hotelTaskDue({ dueDate: '2026-10-20', dueTime: null, overdue: false, done: true }, '2026-10-22')).toBe('сделано');
  });
  it('что с номером', () => {
    expect(hotelUnitNote('DIRTY', false)).toBe('Нужно убрать');
    expect(hotelUnitNote('CLEAN', true)).toBe('Убрано сегодня, ждёт проверки');
    expect(hotelUnitNote('INSPECTED', false)).toBe('Проверено');
  });
});
