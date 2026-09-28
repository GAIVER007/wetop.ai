import { describe, expect, it } from 'vitest';
import type { ChessboardCell } from '../../lib/api';
import { guestNames, sourceBadge, stayLabels } from './stay-labels';

const occupied = (date: string, itemId: string, isArrival = false): ChessboardCell => ({
  date,
  itemId,
  isArrival,
  state: 'OCCUPIED',
  itemStatus: 'CONFIRMED',
});
describe('подпись непрерывного проживания в видимом окне', () => {
  it('показывает имя даже если заезд остался за левой границей', () => {
    expect(stayLabels([occupied('2026-09-13', 'A'), occupied('2026-09-14', 'A')])).toEqual([
      { index: 0, span: 2, continues: true },
    ]);
  });
  it('не объединяет соседние проживания и не протягивает текст через свободную ночь', () => {
    expect(
      stayLabels([
        occupied('2026-09-13', 'A', true),
        occupied('2026-09-14', 'B', true),
        { date: '2026-09-15', state: 'FREE' },
        occupied('2026-09-16', 'B'),
      ]),
    ).toEqual([
      { index: 0, span: 1, continues: false },
      { index: 1, span: 1, continues: false },
      { index: 3, span: 1, continues: true },
    ]);
  });
  it('не рисует полосу бронирования на блокировке', () => {
    expect(stayLabels([{ date: '2026-09-13', state: 'BLOCKED' }])).toEqual([]);
  });
});

describe('имя гостя по ширине плашки (ТЗ v2 §18, §58)', () => {
  it('полное, «Имя Ф.» и инициалы', () => {
    expect(guestNames('Иван Петров')).toEqual({
      full: 'Иван Петров',
      short: 'Иван П.',
      initials: 'ИП',
    });
  });
  it('двойная фамилия и лишние пробелы не ломают сокращение', () => {
    expect(guestNames('  Анна-Мария   Константинопольская-Щербатова ')).toEqual({
      full: 'Анна-Мария Константинопольская-Щербатова',
      short: 'Анна-Мария К.',
      initials: 'АК',
    });
  });
  it('одно слово — без точки; пустое имя — пусто', () => {
    expect(guestNames('Гость')).toEqual({ full: 'Гость', short: 'Гость', initials: 'Г' });
    expect(guestNames('')).toEqual({ full: '', short: '', initials: '' });
  });
});

describe('бейдж источника (ТЗ v2 §21): коротко на плашке, полностью в подсказке', () => {
  it('канал — буквами канала', () => {
    expect(sourceBadge('OTA', 'Booking.com')).toEqual({ code: 'B', name: 'Booking.com' });
    expect(sourceBadge('OTA', 'Agoda')).toEqual({ code: 'A', name: 'Agoda' });
    expect(sourceBadge('OTA', 'Hostelworld')).toEqual({ code: 'HW', name: 'Hostelworld' });
    expect(sourceBadge('OTA', 'Какой-то канал')).toEqual({ code: 'К', name: 'Какой-то канал' });
  });
  it('прямые — коротким словом', () => {
    expect(sourceBadge('DESK', null)).toEqual({ code: 'Стойка', name: 'стойка' });
    expect(sourceBadge('WEBSITE', null)).toEqual({ code: 'Сайт', name: 'сайт' });
    expect(sourceBadge('WHATSAPP', null)).toEqual({ code: 'WA', name: 'WhatsApp' });
  });
  it('без источника — без бейджа', () => {
    expect(sourceBadge(undefined, null)).toBeNull();
  });
});
