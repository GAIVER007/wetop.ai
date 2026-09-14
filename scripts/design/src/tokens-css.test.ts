import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { build, CONTRAST_MD, TOKENS_CSS } from './build-tokens';

/**
 * tokens.css только генерируется (ADR-046). Тест был красным, пока файл был написан руками
 * (14.09.2026, журнал тестов), и снова станет красным после любой ручной правки.
 */
describe('tokens.css и contrast.md сгенерированы из design/tokens.json', () => {
  const built = build();
  it('apps/web/src/app/tokens.css совпадает с выводом генератора', () => {
    expect(readFileSync(TOKENS_CSS, 'utf8')).toBe(built.css);
  });
  it('design/contrast.md совпадает с выводом генератора', () => {
    expect(readFileSync(CONTRAST_MD, 'utf8')).toBe(built.contrast);
  });
});
