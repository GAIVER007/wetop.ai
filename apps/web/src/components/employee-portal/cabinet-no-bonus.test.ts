import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Кабинет мастера (владелец 30.10.2026): премий нет, дата записей окошком календаря, как в журнале */
const src = readFileSync(new URL('./cabinet.tsx', import.meta.url), 'utf8');
describe('кабинет мастера без премий', () => {
  it('строка «Бонусы / Удержания» только если они начислены', () => {
    expect(src).toContain("BigInt(data.pay.bonusMinor ?? '0') !== 0n || BigInt(data.pay.penaltyMinor ?? '0') !== 0n");
    expect(src).not.toContain("t('Только бонусы')");
    expect(src).not.toContain("'Бонусы и удержания: подробности'");
  });
  it('дата записей выбирается окошком (DateInput), а не голым полем даты', () => {
    expect(src).not.toMatch(/<Input name="date" type="date"/);
    expect(src).toMatch(/<DateInput name="date"/);
  });
});
