import { describe, expect, it } from 'vitest';
import { latestWhatsNew, whatsNewFor, type WhatsNewEntry } from './whats-new';

const entries: WhatsNewEntry[] = [
  { date: '2026-10-01', title: 'Общая', text: 'для всех' },
  { date: '2026-10-05', title: 'Салон', text: 'только салон', vertical: 'BEAUTY' },
  { date: '2026-10-03', title: 'Гостиница', text: 'только гостиница', vertical: 'HOSPITALITY' },
];

describe('whatsNewFor (SUP1)', () => {
  it('своё направление и общие, свежие сверху', () => {
    expect(whatsNewFor('BEAUTY', entries).map((e) => e.title)).toEqual(['Салон', 'Общая']);
    expect(whatsNewFor('HOSPITALITY', entries).map((e) => e.title)).toEqual(['Гостиница', 'Общая']);
    expect(whatsNewFor('FOOD_SERVICE', entries).map((e) => e.title)).toEqual(['Общая']);
  });

  it('последняя дата для точки в меню считается по своему направлению', () => {
    expect(latestWhatsNew('BEAUTY', entries)).toBe('2026-10-05');
    expect(latestWhatsNew('FOOD_SERVICE', entries)).toBe('2026-10-01');
    expect(latestWhatsNew('FOOD_SERVICE', [])).toBeNull();
  });
});
