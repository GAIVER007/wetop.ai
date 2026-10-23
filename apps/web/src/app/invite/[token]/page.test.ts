import { createElement as h, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/api', () => ({
  authApi: {
    inviteByToken: vi.fn(async () => ({
      organizationName: 'Тестовый салон',
      email: 'dana@example.invalid',
      expiresAt: '2026-10-28T10:00:00.000Z',
    })),
  },
}));
vi.mock('../../../lib/session', () => ({ clientInfo: async () => ({}) }));
vi.mock('../../../components/auth-shell', () => ({
  AuthShell: ({ children }: { children: ReactNode }) => h('main', null, children),
}));
vi.mock('./accept-form', () => ({ AcceptForm: () => null }));
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
