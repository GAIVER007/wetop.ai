import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');

describe('даты брони и кассы ресторана без ISO (аудит ресторана 22.10.2026)', () => {
  it('карточка брони пишет время визита словами через visitRange в поясе филиала', () => {
    const drawer = source('./reservation-drawer.tsx');
    expect(drawer).toContain('visitRange(r.startsAt, r.endsAt, data.timezone, locale)');
    expect(drawer).not.toContain(".replace('T'");
  });
  it('касса не склеивает ISO-строку через replace', () => {
    expect(source('./cash-board.tsx')).not.toContain(".replace('T'");
  });
});
