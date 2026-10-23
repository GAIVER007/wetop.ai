import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: Record<string, unknown>) =>
    createElement('a', { href, ...rest }, children as never),
}));
import { InventorySummaryLine } from './summary-tiles';
import { placeText, floorText } from './unit-state';

const unit = (over: Record<string, unknown>) =>
  ({
    code: '101',
    kind: 'ROOM',
    active: true,
    block: null,
    housekeepingStatus: 'CLEAN',
    buildingName: null,
    floorName: null,
    roomNumber: '101',
    ...over,
  }) as never;

describe('«Номерной фонд» (аудит 22.10.2026 P1-17)', () => {
  it('расположение без повторов: «Основной корпус, 1 этаж»', () => {
    expect(placeText({ buildingName: 'Основной корпус', floorName: '1 этаж', code: '101', roomNumber: '101' })).toBe(
      'Основной корпус, 1 этаж',
    );
    expect(placeText({ buildingName: 'Б', floorName: '2', code: '201', roomNumber: '201' })).toBe(
      'Корпус Б, 2 этаж',
    );
    expect(placeText({ buildingName: null, floorName: '3', code: 'K1', roomNumber: '301' })).toBe(
      '3 этаж, комната 301',
    );
    expect(floorText('Мансарда')).toBe('Мансарда');
  });

  it('итоги строкой вместо шести плиток, testid прежние, динамики стрелками нет', () => {
    const html = renderToStaticMarkup(
      createElement(InventorySummaryLine, {
        units: [
          unit({}),
          unit({ code: '102', housekeepingStatus: 'DIRTY' }),
          unit({ code: 'B1', kind: 'BED', block: { reason: 'x' } }),
        ],
      }),
    );
    expect(html).not.toContain('inv-tile');
    expect(html).toContain('data-testid="inventory-summary"');
    expect(html.replace(/<[^>]+>/g, '')).toBe(
      'Всего мест 3, номеров 2, койко-мест 1, в продаже 2, недоступно 1, требует уборки 1',
    );
    for (const id of ['total-units', 'rooms', 'beds', 'on-sale', 'blocks', 'needs-cleaning'])
      expect(html).toContain(`data-testid="${id}"`);
  });
});
