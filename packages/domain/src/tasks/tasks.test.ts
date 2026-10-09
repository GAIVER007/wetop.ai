import { describe, expect, it } from 'vitest';
import { parseTaskInput, taskBucket } from './tasks';

describe('parseTaskInput (DATA_MODEL §22)', () => {
  it('новая задача: название, срок, время в 24 часа, приоритет по умолчанию', () => {
    expect(parseTaskInput({ title: '  Позвонить   гостю ', dueDate: '2026-10-05', dueTime: '9.30' }, 'create'))
      .toEqual({ ok: true, value: { title: 'Позвонить гостю', dueDate: '2026-10-05', dueTime: '09:30', priority: 'NORMAL' } });
  });
  it('без названия или срока — отказ словами', () => {
    expect(parseTaskInput({ dueDate: '2026-10-05' }, 'create')).toEqual({ ok: false, reason: 'Напишите, что сделать' });
    expect(parseTaskInput({ title: 'x' }, 'create')).toEqual({ ok: false, reason: 'Срок — дата в виде ГГГГ-ММ-ДД' });
    expect(parseTaskInput({ title: 'x', dueDate: '2026-02-30' }, 'create').ok).toBe(false);
  });
  it('пределы длины, время и приоритет', () => {
    expect(parseTaskInput({ title: 'я'.repeat(201), dueDate: '2026-10-05' }, 'create').ok).toBe(false);
    expect(parseTaskInput({ title: 'x', note: 'я'.repeat(2001), dueDate: '2026-10-05' }, 'create').ok).toBe(false);
    expect(parseTaskInput({ title: 'x', dueDate: '2026-10-05', dueTime: '25:00' }, 'create')).toEqual({ ok: false, reason: 'Время — в виде 14:00 или пусто («весь день»)' });
    expect(parseTaskInput({ title: 'x', dueDate: '2026-10-05', priority: 'URGENT' }, 'create').ok).toBe(false);
  });
  it('правка: только присланные поля; пустое время и описание — снять', () => {
    expect(parseTaskInput({ dueTime: '', note: '' }, 'update')).toEqual({ ok: true, value: { dueTime: null, note: null } });
    expect(parseTaskInput({ done: true }, 'update')).toEqual({ ok: true, value: { done: true } });
    expect(parseTaskInput({ title: '' }, 'update').ok).toBe(false);
    expect(parseTaskInput({ id: 'x' }, 'update')).toEqual({ ok: false, reason: 'Неизвестное поле: id' });
  });
  it('связи: исполнитель и гость — UUID, бронь — по номеру', () => {
    const id = '4f8e1c1e-3b0a-4d1e-9a51-1f0a2b3c4d5e';
    expect(parseTaskInput({ title: 'x', dueDate: '2026-10-05', assigneeUserId: id, reservationNumber: 'B-1' }, 'create'))
      .toMatchObject({ ok: true, value: { assigneeUserId: id, reservationNumber: 'B-1' } });
    expect(parseTaskInput({ title: 'x', dueDate: '2026-10-05', guestId: 'abc' }, 'create').ok).toBe(false);
    expect(parseTaskInput({ title: 'x', dueDate: '2026-10-05', reservationNumber: 5 }, 'create').ok).toBe(false);
    expect(parseTaskInput({ reservationNumber: null }, 'update')).toEqual({ ok: true, value: { reservationNumber: null } });
  });
});

describe('taskBucket', () => {
  it('сделанные, просроченные, сегодня, предстоящие', () => {
    expect(taskBucket({ dueDate: '2026-10-01', done: true }, '2026-10-03')).toBe('done');
    expect(taskBucket({ dueDate: '2026-10-01', done: false }, '2026-10-03')).toBe('overdue');
    expect(taskBucket({ dueDate: '2026-10-03', done: false }, '2026-10-03')).toBe('today');
    expect(taskBucket({ dueDate: '2026-10-04', done: false }, '2026-10-03')).toBe('upcoming');
  });
});
