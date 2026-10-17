import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const actions = readFileSync('apps/web/src/app/reservations/[number]/actions-panel.tsx', 'utf8');
const css = readFileSync('apps/web/src/app/directory.css', 'utf8');

describe('reservation action panel source contract (browser geometry verified separately)', () => {
  it('scopes the action section for its direct forms', () => {
    expect(actions).toMatch(/data-testid="reservation-actions"\s+className="reservation-actions stack stack--mt"/);
  });

  it('uses a zero-min grid track instead of intrinsic form content width', () => {
    expect(css).toMatch(/\.reservation-actions > form\.panel\s*\{[^}]*min-width: 0;[^}]*grid-template-columns: minmax\(0, 1fr\);/);
  });

  it('bounds direct form rows without clipping or changing stay occupancy rows', () => {
    expect(css).toMatch(/\.reservation-actions > form\.panel > \.row\s*\{[^}]*min-width: 0;[^}]*max-width: 100%;\s*\}/);
  });
});
