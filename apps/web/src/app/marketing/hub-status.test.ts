import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => '/marketing' }));

import { MarketingHub, READY_MODULES } from './hub';

/**
 * Владелец 29.10.2026: «где написано Состояние, там везде напиши статус “В работе”; когда будет готово, поменяем на
 * статус “Готово к подключению”». Колонка пульта называется «Статус»; инструмент из `READY_MODULES` показывает
 * «Готово к подключению», остальные «В работе».
 */
describe('пульт «Продвижения»: статус инструментов', () => {
  it.each(['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'] as const)('%s: колонка «Статус», у всех «В работе»', (vertical) => {
    const html = renderToStaticMarkup(createElement(MarketingHub, { vertical }));
    expect(html).toContain('<th scope="col">Статус</th>');
    expect(html).not.toContain('Состояние');
    const statuses = [...html.matchAll(/data-testid="marketing-[a-z]+-status"[^>]*>([^<]+)</g)].map((m) => m[1]);
    expect(statuses.length).toBe(7);
    expect(new Set(statuses)).toEqual(new Set(['В работе']));
    expect(html).toContain('data-label="Статус"');
  });

  it('список готовых пока пуст: «Готово к подключению» включается добавлением инструмента', () => {
    expect([...READY_MODULES]).toEqual([]);
  });
});
