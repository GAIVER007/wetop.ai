import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { METRIC } from './metric-words';

/**
 * Английские сокращения на экранах владельца (аудит гостиницы 22.10.2026 P1-4): «RevPAR», «ADR», «ROMI», «CTR, CPM,
 * CPL» человек не читает. Подписи словами; CSV для бухгалтера и комментарии в коде не трогаем.
 */
const SCREENS = [
  'app/management/analytics/overview.tsx',
  'app/marketing/ads/page.tsx',
  'app/marketing/analytics/page.tsx',
];
const visible = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

describe('показатели словами, без RevPAR/ADR/ROMI/CTR/CPM/CPL', () => {
  it('словарь подписей', () => {
    expect(METRIC.adr).toBe('Средняя цена ночи');
    expect(METRIC.revpar).toBe('Доход на номер');
    expect(METRIC.romi).toBe('Окупаемость рекламы');
    expect(METRIC.cpl).toBe('Цена обращения');
    expect(METRIC.ctr).toBe('Доля кликов');
    expect(METRIC.cpm).toBe('Цена 1000 показов');
  });
  it.each(SCREENS)('%s не показывает сокращений', (file) => {
    const src = visible(readFileSync(resolve(import.meta.dirname, '..', file), 'utf8'));
    expect(src).not.toMatch(/\b(RevPAR|ADR|ROMI|CTR|CPM|CPL)\b/);
  });
});
