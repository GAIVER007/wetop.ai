import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AgentCatalogView } from '../../lib/api';

const { catalog } = vi.hoisted(() => ({ catalog: vi.fn() }));
vi.mock('../../lib/desk-shell', () => ({ deskShell: async () => ({ readOnly: false, vertical: 'BEAUTY' }) }));
vi.mock('../../lib/api', async (orig) => ({ ...(await orig<typeof import('../../lib/api')>()), sellerApi: { catalog } }));
import AiAgentsPage from './page';

const off: AgentCatalogView = {
  extension: { access: 'off', status: null, activeUntil: null, daysLeft: null },
  canManage: true,
  canConfigure: false,
  create: { enabled: false, reason: 'Расширение «ИИ-продавец» не подключено.' },
  agents: [],
};

describe('ИИ-продавец без расширения (аудит 21.10.2026 п. 3)', () => {
  it('одна карточка с действием, без неактивной кнопки снаружи и без повторов «не подключено»', async () => {
    catalog.mockResolvedValue(off);
    const html = renderToStaticMarkup(await AiAgentsPage());
    expect(html).toContain('data-testid="agent-seller-off"');
    expect(html).not.toContain('data-testid="agent-add"');
    expect(html).not.toContain('disabled');
    expect(html.match(/не подключено/gi) ?? []).toHaveLength(1);
    expect(html).toContain('Связаться с поддержкой');
    expect(html).not.toContain('AI-продав');
    expect(html).toContain('Назад к модулям');
  });
  it('подпись кнопки создания без «+» и английского «AI»', async () => {
    const { CREATE_LABEL } = await import('../../lib/ai-agents');
    expect(CREATE_LABEL).toBe('Подключить ИИ-продавца');
  });
});
