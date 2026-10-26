import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Аудит салона 22.10.2026 P1: в окне приглашения салона и ресторана подсказка почты не гостиничная */
describe('приглашение сотрудника', () => {
  it('подсказка почты нейтральная, без «hotel»', () => {
    const source = readFileSync(new URL('./team-board.tsx', import.meta.url), 'utf8');
    expect(source).not.toContain('@hotel');
    expect(source).toContain('placeholder="example@example.com"');
  });
});
