import { createElement as h, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const preview = vi.hoisted(() => ({ locale: 'ru' }));
vi.mock('../../../lib/api', () => ({
  authApi: {
    inviteByToken: vi.fn(async () => ({
      organizationName: 'Тестовый салон',
      locale: preview.locale,
      email: 'dana@example.invalid',
      expiresAt: '2026-10-28T10:00:00.000Z',
    })),
  },
}));
vi.mock('../../../lib/session', () => ({ clientInfo: async () => ({}) }));
vi.mock('../../../components/auth-shell', () => ({
  AuthShell: ({ children }: { children: ReactNode }) => h('main', null, children),
}));
vi.mock('./accept-form', async () => {
  const { useT } = await import('../../../i18n/locale-provider');
  // кнопка — клиентский компонент: берёт язык у LocaleProvider, а не у страницы
  return { AcceptForm: () => h('button', null, useT()('Принять приглашение')) };
});
vi.mock('../../../components/load-error', () => ({ LoadError: () => null }));

import InvitePage from './page';

/** «Ссылка действует до 28 окт.. После…» — две точки подряд (аудит 22.10.2026, P2-1). */
describe('приглашение: срок ссылки', () => {
  it('после короткой даты с точкой второй точки нет', async () => {
    const page = await InvitePage({ params: Promise.resolve({ token: 'fixture-invite-token' }) });
    const text = renderToStaticMarkup(page).replace(/<[^>]+>/g, '');
    expect(text).toContain('Ссылка действует до 28 окт. После принятия');
    expect(text).not.toContain('..');
  });
});

/** Язык организации (ORG-LOCALE-20261026): салон на английском зовёт английской страницей, без кириллицы */
describe('приглашение: язык организации', () => {
  it('английская организация: страница на английском, даже без куки языка', async () => {
    preview.locale = 'en';
    try {
      const page = await InvitePage({ params: Promise.resolve({ token: 'fixture-invite-token' }) });
      const html = renderToStaticMarkup(page);
      const text = html.replace(/<[^>]+>/g, '');
      expect(text).toContain('You are invited');
      expect(text).toContain('Accept invitation');
      expect(text).toContain('The link is valid until 28 Oct');
      expect(text.replace('Тестовый салон', '')).not.toMatch(/[А-Яа-яЁё]/);
      expect(html).toContain('lang="en"');
    } finally {
      preview.locale = 'ru';
    }
  });
});
