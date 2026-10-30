import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../actions', () => ({
  saveBeautyService: vi.fn(),
  saveLocationService: vi.fn(),
  moveLocationServices: vi.fn(),
}));
vi.mock('../../../components/overlay', () => ({ Overlay: () => null }));
import { ServicesBoard } from './board';

// доля визитов видна у услуг филиала (левая колонка, 30.10.2026)
const row = { id: 'service', name: 'Тестовая услуга', category: null, durationMinutes: 60,
  priceMinor: '800000', currency: 'KZT', active: true,
  location: { enabled: true, priceOverrideMinor: null, durationOverrideMinutes: null },
  effective: { sellable: true, priceMinor: '800000', currency: 'KZT', durationMinutes: 60, overridden: false } };
describe('Доля завершённых визитов в каталоге', () => {
  it('показывает процент и числитель со знаменателем словами', () => {
    const html = renderToStaticMarkup(createElement(ServicesBoard, { canEdit: false, locationCurrency: 'KZT',
      items: [{ ...row, popularity: { completedVisits: 3, totalCompletedVisits: 4 } }] }));
    expect(html).toContain('75 %');
    expect(html).toContain('title="Доля завершённых визитов"');
  });
  it('при нулевом числе визитов ничего не показывает', () => {
    const html = renderToStaticMarkup(createElement(ServicesBoard, { canEdit: false, locationCurrency: 'KZT',
      items: [{ ...row, popularity: { completedVisits: 0, totalCompletedVisits: 0 } }] }));
    expect(html).not.toMatch(/\d %/);
    expect(html).not.toContain('NaN');
  });
});
