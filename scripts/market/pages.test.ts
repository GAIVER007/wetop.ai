import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { estimateNightOccupancy } from '@pms/domain';
import { parseObservation } from './sources';

/**
 * Записанные страницы площадок (`tests/fixtures/market-pages/`, 09.10.2026) и ручная разметка. Ответы моделей пишет
 * `npm run market:eval` в `recorded/<модель>.json`; по ним разбор проверяется здесь без сети.
 */
const DIR = 'tests/fixtures/market-pages';
const labels = JSON.parse(readFileSync(`${DIR}/labels.json`, 'utf8')) as Array<{
  file: string;
  expected: { status: 'sold_out' | 'available' | 'blocked' | 'unknown'; roomsLeft: number | null };
}>;
const recordings = existsSync(`${DIR}/recorded`)
  ? readdirSync(`${DIR}/recorded`).filter((f) => f.endsWith('.json'))
  : [];

describe('страницы площадок: разметка', () => {
  it('у каждой страницы есть разметка, отзывов и почты в страницах нет', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.txt')).sort();
    expect(labels.map((l) => l.file).sort()).toEqual(files);
    for (const f of files) {
      const text = readFileSync(`${DIR}/${f}`, 'utf8');
      expect(text, f).not.toMatch(/отзыв|review/i);
      expect(text, f).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/);
    }
  });

  it('остаток размечен только у «продаётся»; оценка по разметке считается', () => {
    for (const l of labels) {
      if (l.expected.status !== 'available') expect(l.expected.roomsLeft, l.file).toBeNull();
      expect(() => estimateNightOccupancy(l.expected, 40)).not.toThrow();
    }
  });
});

describe.runIf(recordings.length > 0)('записанные ответы моделей совпадают с разметкой', () => {
  for (const rec of recordings) {
    it(rec.replace('.json', ''), () => {
      const answers = JSON.parse(readFileSync(`${DIR}/recorded/${rec}`, 'utf8')) as Record<string, string | null>;
      for (const l of labels) {
        const raw = answers[l.file];
        const got = raw == null ? { status: 'unknown', roomsLeft: null } : parseObservation(raw);
        expect(got, `${rec} ${l.file}`).toEqual(l.expected);
      }
    });
  }
});

describe('Ostrovok без модели: правила по тексту блока номеров', () => {
  it('на всех записанных страницах Ostrovok совпадает с ручной разметкой', async () => {
    const { ostrovokObservation } = await import('./sources');
    const own = labels.filter((l) => l.file !== 'booking-1020.txt' && l.file !== 'yandex-1020.txt');
    expect(own).toHaveLength(7);
    for (const l of own) {
      const got = ostrovokObservation(readFileSync(`${DIR}/${l.file}`, 'utf8'));
      expect({ status: got.status, roomsLeft: got.roomsLeft }, l.file).toEqual(l.expected);
    }
  });

  it('самый малый видимый остаток для уровня; нет предложений, проверка площадки, пустая страница', async () => {
    const { ostrovokObservation } = await import('./sources');
    const page = (f: string) => readFileSync(`${DIR}/${f}`, 'utf8');
    expect(ostrovokObservation(page('evergreen-1010.txt')).fewestLeft).toBe(5);
    expect(ostrovokObservation(page('ramada-1231.txt')).fewestLeft).toBe(1);
    expect(ostrovokObservation('Заезд\n20 окт\nНа 1 ночь, для 1 взрослого\nНет доступных вариантов на эти даты')).toEqual({
      status: 'sold_out',
      roomsLeft: null,
      fewestLeft: null,
    });
    expect(ostrovokObservation(page('yandex-1020.txt')).status).toBe('blocked');
    expect(ostrovokObservation('').status).toBe('unknown');
  });
});
