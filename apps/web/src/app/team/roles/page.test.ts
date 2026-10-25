import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const organizationId = '11111111-1111-4111-8111-111111111111';
const businessId = '21111111-1111-4111-8111-111111111111';

const state = vi.hoisted(() => ({
  positions: vi.fn(),
  boardProps: null as null | Record<string, unknown>,
}));

vi.mock('../../../lib/session', () => ({
  sessionToken: async () => 'synthetic-session',
}));
vi.mock('../../../lib/desk-shell', () => ({
  currentMe: async () => ({
    user: { role: 'OWNER', organizationId },
    context: { vertical: 'BEAUTY', businessId },
  }),
  deskShell: async () => ({
    vertical: 'BEAUTY',
    readOnly: false,
    access: { role: 'OWNER' },
  }),
}));
vi.mock('../../../lib/navigation', () => ({
  deskAccessOf: () => ({ role: 'OWNER' }),
  mayBeautyAccess: () => true,
}));
vi.mock('../../../lib/api', () => ({
  beautyApi: { positions: state.positions },
}));
vi.mock('../../../components/team-navigation', () => ({
  TeamNavigation: () => null,
}));
// язык стойки (KK1) читает куку запроса; здесь запроса нет, страница русская
vi.mock('../../../i18n/server', async () => ({
  serverT: async () => (await import('../../../i18n')).translator('ru'),
  currentLocale: async () => 'ru',
}));
vi.mock('./positions-board', () => ({
  PositionsBoard: (props: Record<string, unknown>) => {
    state.boardProps = props;
    return createElement('div', { 'data-testid': 'positions-board' });
  },
}));

import TeamRolesPage from './page';

describe('Team roles page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.boardProps = null;
    state.positions.mockResolvedValue({
      businessId,
      positions: [],
      assignments: [],
      members: [],
      locations: [],
    });
  });

  it('loads business-wide Beauty positions when the context omits locationId', async () => {
    const html = renderToStaticMarkup(await TeamRolesPage());

    expect(state.positions).toHaveBeenCalledTimes(1);
    expect(state.boardProps).toMatchObject({
      scopeKey: JSON.stringify({ organizationId, businessId, locationId: null }),
    });
    expect(html).toContain('data-testid="positions-board"');
  });
});
