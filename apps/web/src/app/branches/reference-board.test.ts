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
      archive: createElement('button', { type: 'button' }, 'Test archive'),
      preview: false,
    }),
  );
describe('organization workspace states', () => {
  it('does not reserve an empty cover or repeat business financial widgets', () => {
    const html = render([item], [card]);
    expect(html).toContain('class="org-card-footer"');
    expect(html).not.toContain('org-cards--workspace');
    expect(html).not.toContain('class="org-cover ');
    expect(html).not.toContain('Добавьте описание бизнеса');
    expect(html).not.toContain('Учёт оплат не подключён');
  });

  it('shows all businesses without filter tools and keeps archive in heading', () => {
    const html = render(
      [item, { ...item, id: 'second-object', location: { businessId: 'second-project' } }],
      [card, { ...card, id: 'second-project', name: 'Second project' }],
    );
    expect(html).not.toContain('org-tools');
    expect(html).not.toContain('Поиск бизнесов и филиалов');
    expect(html).toContain('Test project');
    expect(html).toContain('Second project');
    expect(html.indexOf('Test archive')).toBeLessThan(html.indexOf('org-totals'));
  });
  it('separates address and capacity without inventing an operating status', () => {
    const hotel = {
      ...item,
      name: 'Test hotel',
      address: 'Test street, 12',
      vertical: 'HOSPITALITY' as const,
      _count: { inventoryUnits: 88, accommodationTypes: 5 },
    };
    const html = render([hotel], []);
    expect(html).toMatch(/class="org-branch-address"[^>]*>Test street, 12<\/small>/);
    expect(html).toContain('Номеров и коек: 88');
    // имя и одна строка сведений у любого направления: ёмкость отеля внутри той же строки, что адрес
    expect(html).toMatch(/class="org-branch-meta"><small[^>]*>Test street, 12<\/small><span class="org-branch-capacity">/);
    expect(html).toContain('Категорий: 5');
    expect(html).toContain('aria-label="Открыть объект: Test hotel"');
    expect(html).not.toContain('class="org-dot"');
  });

  it('keeps the page focused on business cards without lower panels', () => {
    const html = render([item], [card]);
    expect(html).not.toContain('Результаты по объектам');
    expect(html).not.toContain('org-bottom');
    expect(html).toContain('Test object');
  });
  it('итоги месяца одной строкой под списком объектов, слова салона (аудит 22.10.2026 P1-3a)', () => {
    const html = renderToStaticMarkup(
      createElement(ReferenceBoard, {
        organization: 'Test organization',
        periodLabel: '',
        items: [item],
        businesses: [card],
        money: [],
        metrics: {},
        create: null,
        preview: false,
        financial: {
          from: '2026-10-01', to: '2026-10-31', complete: true, covered: 1, total: 1, orders: 2, rows: [],
          currencies: [{ currency: 'KZT', receiptsMinor: '100000', expensesMinor: '0', orders: 2, averageMinor: '50000' }],
        },
      }),
    );
    expect(html.indexOf('Test object')).toBeLessThan(html.indexOf('data-testid="org-totals"'));
    expect(html).toContain('<dt>Оплаченные записи</dt>');
  });
  it('keeps a configured existing hotel when the older API omits card metadata', () => {
    const existing = {
      ...item,
      name: 'Configured hotel',
      vertical: 'HOSPITALITY' as const,
      _count: { inventoryUnits: 88, accommodationTypes: 5 },
    };
    const html = render([existing], []);
    expect(html).toContain('<h2 title="Configured hotel">Configured hotel</h2>');
    expect(html).toContain('Configured hotel');
    expect(html).toContain('value="object"');
    expect(html).toContain('88');
  });
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
    expect(html).not.toContain('org-open');
  });
});
