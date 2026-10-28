import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from './manifest';
import { PWA_THEME } from '../lib/pwa';

/** Значение переменной из сгенерированного `tokens.css` в блоке темы (светлая идёт первой, тёмная своим блоком) */
function cssVar(name: string, theme: 'light' | 'dark'): string {
  const css = readFileSync(join(__dirname, 'tokens.css'), 'utf8');
  const block = theme === 'light' ? css.slice(0, css.indexOf("[data-theme='dark']")) : css.slice(css.indexOf("[data-theme='dark']"));
  return block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))![1]!.toLowerCase();
}

describe('PWA1: манифест стойки', () => {
  const m = manifest();

  it('ставится как приложение и открывается на «Сегодня»', () => {
    expect(m).toMatchObject({ name: 'WETOP', short_name: 'WETOP', start_url: '/', scope: '/', display: 'standalone' });
  });

  it('значки 192 и 512 px, отдельный маскируемый 512 px, все PNG', () => {
    expect(m.icons).toEqual([
      { src: '/pwa-icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon/maskable', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ]);
  });

  it('цвета из токенов: главный цвет стойки и фон в светлой и тёмной теме', () => {
    expect(PWA_THEME.light).toBe(cssVar('--primary', 'light'));
    expect(PWA_THEME.dark).toBe(cssVar('--primary', 'dark'));
    expect(PWA_THEME.background).toBe(cssVar('--bg', 'light'));
    expect(m.theme_color).toBe(PWA_THEME.light);
    expect(m.background_color).toBe(PWA_THEME.background);
  });
});
