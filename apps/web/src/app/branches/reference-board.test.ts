import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReferenceBoard } from './reference-board';
import type { BranchItem, BusinessCardView } from '../../lib/api';
vi.mock('./actions', () => ({ selectBranch: vi.fn(), saveBusinessCard: vi.fn() }));
const card: BusinessCardView = {
  id: 'project',
  name: 'Test project',
  vertical: 'BEAUTY',
  description: null,
  coverUrl: null,
  hasCover: false,
  updatedAt: '',
  canEdit: true,
  canUpload: false,
};
const item: BranchItem = {
  id: 'object',
  name: 'Test object',
  address: null,
  currency: 'KZT',
  timezone: 'Asia/Almaty',
  vertical: 'BEAUTY',
  locationId: 'object',
  location: { businessId: card.id },
  _count: { inventoryUnits: 0, accommodationTypes: 0 },
};
const render = (items: BranchItem[], businesses: BusinessCardView[]) =>
  renderToStaticMarkup(
    createElement(ReferenceBoard, {
      organization: 'Test organization',
      periodLabel: '',
      items,
      businesses,
      money: [],
      metrics: {},
      create: null,
      trend: null,
      recent: null,
      preview: false,
    }),
  );
describe('organization workspace states', () => {
  it('starts with a compact project and one object without direction filters', () => {
    const html = render([item], [card]);
    expect(html).toContain('org-reference--single');
    expect(html).toContain('Test object');
    expect(html).not.toContain('aria-label="Направление бизнеса"');
  });
  it('offers a helpful empty state rather than a search error', () => {
    expect(render([], [])).toContain('Пока нет доступных проектов');
    expect(render([], [])).not.toContain('Ничего не найдено');
  });
  it('keeps an empty project editable without an invalid open action', () => {
    const html = render([], [card]);
    expect(html).toContain('Test project');
    expect(html).toContain('Объекты ещё не добавлены');
    expect(html).toContain('Редактировать: Test project');
    expect(html).not.toContain('class="org-open"');
  });
});
