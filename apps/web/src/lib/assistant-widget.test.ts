import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT ${to}`);
});
vi.mock('next/navigation', () => ({ redirect }));

import { assistantScriptProps, assistantScriptSrc, nextWidgetOwner } from './assistant-widget';
import { widgetOwnerKey } from './assistant-widget-owner';
import { assistantApi } from './api';

/**
 * Тег виджета ИИ-помощника в стойке (ТЗ ред. 1, П2; docs/assistant/README.md §1):
 * `<script async src="{ASSISTANT_URL}/widget/widget.js" data-identity="{подпись}">`.
 */

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  redirect.mockClear();
});

describe('assistantScriptSrc — адрес скрипта по ASSISTANT_URL', () => {
  it('без настройки тега нет', () => {
    expect(assistantScriptSrc(undefined)).toBeNull();
    expect(assistantScriptSrc('')).toBeNull();
    expect(assistantScriptSrc('   ')).toBeNull();
  });

  it('скрипт лежит у помощника по /widget/widget.js; слеш в конце адреса не удваивается', () => {
    expect(assistantScriptSrc('https://assistant.wetop.ai')).toBe(
      'https://assistant.wetop.ai/widget/widget.js',
    );
    expect(assistantScriptSrc('https://assistant.wetop.ai/')).toBe(
      'https://assistant.wetop.ai/widget/widget.js',
    );
  });

  it('путь в адресе сохраняется', () => {
    expect(assistantScriptSrc('http://127.0.0.1:8000/bot')).toBe(
      'http://127.0.0.1:8000/bot/widget/widget.js',
    );
  });

  it('не http(s) и не адрес вовсе — тега нет, а не скрипт с чужой схемой', () => {
    expect(assistantScriptSrc('assistant.wetop.ai')).toBeNull();
    expect(assistantScriptSrc('javascript:alert(1)')).toBeNull();
    expect(assistantScriptSrc('ftp://assistant.wetop.ai')).toBeNull();
  });
});

describe('assistantScriptProps — атрибуты тега', () => {
  it('вошедшему — подпись в data-identity', () => {
    expect(assistantScriptProps('https://assistant.wetop.ai', 'abc.def')).toEqual({
      src: 'https://assistant.wetop.ai/widget/widget.js',
      'data-identity': 'abc.def',
    });
  });

  it('невошедшему атрибута data-identity нет совсем, а не пустой', () => {
    const props = assistantScriptProps('https://assistant.wetop.ai', null);
    expect(props).toEqual({ src: 'https://assistant.wetop.ai/widget/widget.js' });
    expect(props && 'data-identity' in props).toBe(false);
  });

  it('без адреса помощника тега нет, даже с подписью', () => {
    expect(assistantScriptProps(undefined, 'abc.def')).toBeNull();
  });
});

describe('смена вошедшего без перезагрузки страницы', () => {
  it('ключ хозяина виджета — от сессии: одна сессия — один ключ, другая — другой', () => {
    expect(widgetOwnerKey(null)).toBe('');
    expect(widgetOwnerKey('session-a')).toBe(widgetOwnerKey('session-a'));
    expect(widgetOwnerKey('session-a')).not.toBe(widgetOwnerKey('session-b'));
  });

  it('ключ не совпадает с отпечатком сессии в базе и не выдаёт её ключ', () => {
    const dbHash = createHash('sha256').update('session-a').digest('hex');
    expect(widgetOwnerKey('session-a')).not.toBe(dbHash);
    expect(dbHash.startsWith(widgetOwnerKey('session-a'))).toBe(false);
    expect(widgetOwnerKey('session-a')).not.toContain('session-a');
  });

  it('первая отрисовка запоминает хозяина и страницу не трогает', () => {
    expect(nextWidgetOwner(null, 'k1')).toEqual({ owner: 'k1', reload: false });
    expect(nextWidgetOwner(null, '')).toEqual({ owner: '', reload: false });
  });

  it('тот же хозяин — ничего; вход, выход, другой человек — перезагрузка', () => {
    expect(nextWidgetOwner('k1', 'k1')).toEqual({ owner: 'k1', reload: false });
    expect(nextWidgetOwner('', 'k1')).toEqual({ owner: 'k1', reload: true });
    expect(nextWidgetOwner('k1', '')).toEqual({ owner: '', reload: true });
    expect(nextWidgetOwner('k1', 'k2')).toEqual({ owner: 'k2', reload: true });
  });
});

describe('assistantApi.identity — подпись с сервера стойки', () => {
  it('отдаёт подпись и срок', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ token: 'abc.def', expiresAt: '2026-09-25T00:00:00.000Z' }),
        ),
    );
    await expect(assistantApi.identity()).resolves.toEqual({
      token: 'abc.def',
      expiresAt: '2026-09-25T00:00:00.000Z',
    });
  });

  it('401 — чат анонимный, и на вход не уводит: макет рисуется и на самом экране входа', async () => {
    vi.stubEnv('APP_AUTH_REQUIRED', '1');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    await expect(assistantApi.identity()).resolves.toBeNull();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('подпись не настроена (503) или API молчит — чат анонимный, страница не падает', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })));
    await expect(assistantApi.identity()).resolves.toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(assistantApi.identity()).resolves.toBeNull();
  });

  it('кривой ответ не превращается в подпись', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ token: 42 })));
    await expect(assistantApi.identity()).resolves.toBeNull();
  });
});
