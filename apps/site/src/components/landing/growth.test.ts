import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ru } from '../../i18n/ru';

/**
 * Кнопки витрин «Маркетинг» и «ИИ» на главной (аудит 22.10.2026, P1-11): раньше вели в стойку
 * (`app.wetop.ai/market`, `/ai-seller/agents`), и посетитель без аккаунта попадал на экран входа.
 * Теперь они открывают регистрацию, как остальные призывы лендинга.
 */
describe('витрины «Продажи, маркетинг и ИИ»', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'growth.tsx'), 'utf8');
  it('ни одна кнопка не ведёт в стойку', () => {
    expect(source).not.toMatch(/appUrl\}\/(market|ai-seller)/);
    expect(source).not.toContain('siteConfig.appUrl');
  });
  it('все три кнопки открывают окно регистрации', () => {
    expect(source.match(/data-auth="register"/g)).toHaveLength(3);
  });
  it('подписи кнопок обещают то, что происходит: регистрацию, а не просмотр', () => {
    expect(ru.growth.market.action).toBe('Попробовать анализ рынка');
    expect(ru.growth.ai.action).toBe('Подключить ИИ-продавца');
  });
});
