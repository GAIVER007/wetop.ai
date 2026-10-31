import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Аудит кабинета владельца 31.10.2026 (1440×900): подсказка гейта салона стояла голым текстом над шапкой
 * («К содержимому» перекрывала её, ссылка без вида кнопки). Теперь это аккуратная полоса под шапкой.
 */
const gate = readFileSync(new URL('./onboarding-gate.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./components.css', import.meta.url), 'utf8');

describe('подсказка гейта салона', () => {
  it('полоса gate-notice с кнопкой, а не голый .alert', () => {
    expect(gate).not.toContain('className="alert" role="status"');
    expect(gate.match(/className="gate-notice"/g)).toHaveLength(2);
    expect(gate).toContain('className="btn btn--secondary btn--sm"');
  });
  it('стиль полосы токенами: одна строка, по ширине страницы', () => {
    const rule = css.slice(css.indexOf('.gate-notice {'), css.indexOf('}', css.indexOf('.gate-notice {')));
    expect(rule).toContain('display: flex');
    expect(rule).toContain('var(--space-');
    expect(rule).not.toMatch(/\d+px(?! solid)/);
  });
  it('в разметке полоса идёт после шапки, а не над ней', () => {
    const layout = readFileSync(new URL('./layout.tsx', import.meta.url), 'utf8');
    expect(layout.indexOf('<OnboardingGate />')).toBeGreaterThan(layout.indexOf('<TopNav'));
  });
});
