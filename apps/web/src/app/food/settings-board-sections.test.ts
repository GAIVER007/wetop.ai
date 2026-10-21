import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { FoodWorkspace } from '../../lib/food-types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock('./actions', () => ({ saveBookingRules: vi.fn(), saveFoodCatalog: vi.fn() }));

import { RestaurantSettings } from './settings-board';

/**
 * Настройки ресторана в порядке хаба (поручение владельца 21.10.2026): пустого раздела «Уведомления» нет (у ресторана
 * нет ни одной настройки уведомлений, был только текст), первым пунктом путь ко всем настройкам.
 */
describe('Настройки ресторана: разделы', () => {
  const html = renderToStaticMarkup(
    createElement(RestaurantSettings, {
      data: { canProperty: true, readOnly: false, scopeKey: 'b:l', timezone: 'Asia/Almaty', periods: [], areas: [], tables: [] } as unknown as FoodWorkspace,
      section: 'hours',
      physicalOpening: createElement('p', null, 'часы'),
    }),
  );
  it('пустого раздела «Уведомления» нет', () => {
    expect(html).not.toContain('Уведомления');
    expect(html).not.toContain('section=notifications');
  });
  it('первым пунктом «Все настройки» ведёт в хаб', () => {
    const nav = html.slice(html.indexOf('rest-settings__nav'));
    expect(nav.indexOf('href="/settings"')).toBeGreaterThan(-1);
    expect(nav.indexOf('href="/settings"')).toBeLessThan(nav.indexOf('section=hours'));
  });
});
