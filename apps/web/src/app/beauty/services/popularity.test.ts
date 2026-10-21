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

const row = { id: 'service', name: 'Тестовая услуга', category: null, durationMinutes: 60,
  priceMinor: '800000', currency: 'KZT', active: true, location: null, effective: null };
describe('Доля завершённых визитов в каталоге', () => {
  it('показывает процент и числитель со знаменателем словами', () => {
    const html = renderToStaticMarkup(createElement(ServicesBoard, { canEdit: false, locationCurrency: 'KZT',
      items: [{ ...row, popularity: { completedVisits: 3, totalCompletedVisits: 4 } }] }));
    expect(html).toContain('75%');
    expect(html).toContain('визитов');
  });
  it('при нулевом числе визитов ничего не показывает', () => {
    const html = renderToStaticMarkup(createElement(ServicesBoard, { canEdit: false, locationCurrency: 'KZT',
      items: [{ ...row, popularity: { completedVisits: 0, totalCompletedVisits: 0 } }] }));
    expect(html).not.toContain('визитов');
    expect(html).not.toContain('NaN');
  });
});
