import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ unstable_rethrow: () => undefined, useRouter: () => ({ refresh() {} }) }));
vi.mock('../../../lib/vertical-guard', () => ({ requireFeature: async () => ({ context: { vertical: 'BEAUTY' } }) }));
vi.mock('../../../lib/desk-shell', () => ({ deskShell: async () => ({ readOnly: true, access: { role: 'OWNER' } }) }));
vi.mock('./actions', () => ({ writeBusinessSnapshotAction: vi.fn(), saveBusinessCompetitorAction: vi.fn(), archiveBusinessCompetitorAction: vi.fn() }));
const cell = (day: string, level: 'SOLD_OUT' | 'AVAILABLE' | null, source: 'MANUAL' | 'AI_AGENT' | null, freeSlots: number | null = null) => ({
  day,
  level,
  freeSlots,
  source,
  observedOn: level ? '2026-10-24' : null,
});
vi.mock('../../../lib/api', () => ({
  businessMarketApi: {
    board: async () => ({
      today: '2026-10-24',
      competitors: [{ id: 'c1', name: 'Студия', address: null, distanceM: 200, url: 'https://dikidi.net/ru/record/1', note: null, active: true }],
      board: {
        days: ['2026-10-24', '2026-10-25', '2026-10-26'],
        competitors: [
          {
            id: 'c1',
            name: 'Студия',
            url: 'https://dikidi.net/ru/record/1',
            distanceM: 200,
            platform: 'Dikidi',
            lastObservedOn: '2026-10-24',
            cells: [cell('2026-10-24', 'AVAILABLE', 'AI_AGENT', 9), cell('2026-10-25', 'SOLD_OUT', 'MANUAL'), cell('2026-10-26', null, null)],
          },
        ],
        market: [
          { day: '2026-10-24', withData: 1, tight: 0, full: false },
          { day: '2026-10-25', withData: 1, tight: 1, full: true },
          { day: '2026-10-26', withData: 0, tight: 0, full: false },
        ],
        summary: { competitors: 1, withData: 1, fullDays: 1, lastObservedOn: '2026-10-24' },
      },
    }),
  },
}));

import BusinessMarketPage from './page';

/** Сборщик соседей (§60, срез 3): клетка, которую записал сборщик, помечена «ИИ»; ручная и пустая без метки */
describe('«Конкуренты» салона: метка сборщика', () => {
  it('«ИИ» только у клетки AI_AGENT, подсказка называет Dikidi и Restoplace и что ручной ввод главнее', async () => {
    const html = renderToStaticMarkup(await BusinessMarketPage({ searchParams: Promise.resolve({}) }));
    expect(html.match(/data-testid="bm-cell-collected"/g)).toHaveLength(1);
    expect(html).toContain('окон 9');
    expect(html).toContain('Dikidi или брони Restoplace');
    expect(html).toContain('ваш ввод за сегодня главнее сборщика');
    expect(html).not.toContain('подключается отдельно');
  });
});
