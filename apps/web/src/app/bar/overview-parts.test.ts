import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { BarReceiptRow } from '../../lib/api';
import { OverviewEmpty, ReceiptsAside } from './overview-parts';

const receipt = (over: Partial<BarReceiptRow>): BarReceiptRow => ({
  id: 'r1', status: 'POSTED', documentNumber: 'П-000122', receivedDate: '2026-10-20T00:00:00.000Z',
  totalAmount: '120000', paidAmount: '0', dueAmount: '120000', supplier: { id: 's1', name: 'FoodMaster' },
  _count: { lines: 3 }, ...over,
} as BarReceiptRow);

/** Владелец 25.10.2026: «Склад: бар» на один экран ПК */
describe('обзор склада на один экран', () => {
  it('пустой склад одной строкой с двумя кнопками, без большого блока', () => {
    const html = renderToStaticMarkup(createElement(OverviewEmpty, { canCreate: true, canReceive: true }));
    expect(html).toContain('class="panel bar-empty-line"');
    expect(html).not.toContain('empty-state');
    expect(html).toContain('Товаров пока нет');
    expect(html).toContain('href="/bar/products#new-product"');
    expect(html).toContain('href="/bar/receipts/new"');
    const readOnly = renderToStaticMarkup(createElement(OverviewEmpty, { canCreate: false, canReceive: false }));
    expect(readOnly).not.toContain('<a');
  });

  it('приходы колонкой рядом с остатками: дата, поставщик с номером под ним, сумма, статус', () => {
    const html = renderToStaticMarkup(createElement(ReceiptsAside, {
      receipts: [receipt({}), receipt({ id: 'r2', documentNumber: 'П-000121', dueAmount: '0', paidAmount: '120000' })],
      currency: 'QAR',
    }));
    expect(html).toContain('class="panel bar-receipts-aside"');
    expect(html).toContain('aria-label="Последние приходы поставщиков"');
    const head = html.slice(html.indexOf('<thead'), html.indexOf('</thead>'));
    expect(head.match(/<th[^>]*>(.*?)<\/th>/g)?.map((th) => th.replace(/<[^>]+>/g, ''))).toEqual(['Дата', 'Поставщик', 'Сумма', 'Статус']);
    expect(html).toContain('П-000122');
    expect(html).toContain('Не оплачен');
    expect(html).toContain('Оплачен');
    expect(html).toContain('href="/bar/receipts"');
    const none = renderToStaticMarkup(createElement(ReceiptsAside, { receipts: [], currency: 'QAR' }));
    expect(none).toContain('class="bar-muted bar-one-line"');
  });
});
