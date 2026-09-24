import { describe, expect, it } from 'vitest';
import { assistantScriptSrc, loginLink, trialLink } from './site';
import type { SiteConfig } from '../site.config';

const config = (over: Partial<SiteConfig> = {}): SiteConfig => ({
  siteUrl: 'https://wetop.ai',
  appUrl: 'https://app.wetop.ai',
  trialHref: '',
  assistantUrl: '',
  company: { name: '', city: '', email: '', phone: '', about: '' },
  ...over,
});

/**
 * «Войти» на главной ведёт на экран входа стойки, а не в корень. Корень стойки редиректом бросает в `/today`
 * (apps/web/src/app/page.tsx), то есть человек проваливался сразу в рабочий день смены и экрана входа не видел:
 * под кем он вошёл и как выйти — негде посмотреть. Экран `/login` это показывает (ADR-045, Д5).
 */
describe('loginLink', () => {
  it('ведёт на экран входа стойки', () => {
    expect(loginLink(config()).href).toBe('https://app.wetop.ai/login');
  });

  it('не удваивает слеш, если адрес стойки записан со слешем в конце', () => {
    expect(loginLink(config({ appUrl: 'https://app.wetop.ai/' })).href).toBe(
      'https://app.wetop.ai/login',
    );
  });

  it('ведёт наружу — стойка на другом хосте', () => {
    expect(loginLink(config()).external).toBe(true);
  });

  it('останавливает сборку, если адрес стойки записан неверно', () => {
    expect(() => loginLink(config({ appUrl: 'app.wetop.ai' }))).toThrow(/appUrl/);
  });
});

describe('trialLink', () => {
  it('без ссылки владельца ведёт в раздел «Как начать» на самой главной', () => {
    expect(trialLink(config())).toEqual({ href: '/#start', external: false });
  });
});

/**
 * Чат ИИ-помощника на главной (ТЗ ред. 1, П2): тот же тег, что в стойке, но без `data-identity` — посетитель
 * главной аноним. Адрес задаёт владелец в `site.config.ts` (Q-180): сайт статический, окружения во время работы нет.
 */
describe('assistantScriptSrc', () => {
  it('без адреса помощника чата на главной нет', () => {
    expect(assistantScriptSrc(config())).toBeNull();
    expect(assistantScriptSrc(config({ assistantUrl: '   ' }))).toBeNull();
  });

  it('скрипт виджета лежит у помощника по /widget/widget.js', () => {
    expect(assistantScriptSrc(config({ assistantUrl: 'https://assistant.wetop.ai' }))).toBe(
      'https://assistant.wetop.ai/widget/widget.js',
    );
    expect(assistantScriptSrc(config({ assistantUrl: 'https://assistant.wetop.ai/' }))).toBe(
      'https://assistant.wetop.ai/widget/widget.js',
    );
  });

  it('останавливает сборку, если адрес записан неверно', () => {
    expect(() => assistantScriptSrc(config({ assistantUrl: 'assistant.wetop.ai' }))).toThrow(
      /assistantUrl/,
    );
  });
});
