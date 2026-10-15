import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Business vertical schema contract', () => {
  it('persists FOOD_SERVICE on Business while keeping Location without vertical', () => {
    const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
    const vertical = schema.match(/enum BusinessVertical \{([^}]+)\}/)?.[1] ?? '';
    expect(vertical).toContain('FOOD_SERVICE');
    const location = schema.match(/model Location \{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(location).not.toMatch(/^\s*vertical\s/m);
  });
});
