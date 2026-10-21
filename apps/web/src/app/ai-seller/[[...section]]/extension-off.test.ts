import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SellerStatus } from '../../../lib/api';

const { status } = vi.hoisted(() => ({ status: vi.fn() }));
vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn(), notFound: vi.fn(), redirect: vi.fn() }));
vi.mock('../../../lib/desk-shell', () => ({
  deskShell: async () => ({ vertical: 'BEAUTY', access: { role: null, platform: false, restricted: false } }),
}));
vi.mock('../../../lib/api', async (orig) => ({ ...(await orig<typeof import('../../../lib/api')>()), sellerApi: { status } }));
import AiSellerPage from './page';

const off = {
  state: 'extension-off',
  profile: { saved: false, updatedAt: null, applied: false },
  facts: { applied: false, appliedAt: null },
  lastError: null,
  lastErrorAt: null,
  retrying: false,
  embedAvailable: false,
} as unknown as SellerStatus;

describe('ИИ-продавец без расширения (аудит 21.10.2026 п. 25)', () => {
  it('одна карточка, вкладок «Обзор, Настройка, Диалоги» нет', async () => {
    status.mockResolvedValue(off);
    const html = renderToStaticMarkup(
      await AiSellerPage({ params: Promise.resolve({}), searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain('data-testid="seller-extension-off"');
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain('Диалоги');
  });
});
