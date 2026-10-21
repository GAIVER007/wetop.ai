import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { OwnerSummaryView } from './unified-owner';
import type { OwnerSummaryDto } from '../../lib/owner-summary';

/**
 * Главная на одном экране компьютера (решение владельца 21.10.2026: «не хочу листать, чётко на одном экране»,
 * эскиз ~/sketches/home принят «Да окей четко»): шапка одной строкой, итоги строкой, ниже график слева и
 * справа «Требуют решения» и «Куда уходят деньги».
 */
const money = (amount: string) => ({
  state: 'READY' as const,
  reason: null,
  unresolvedSources: 0,
  currencies: [{ currency: 'KZT', amountMinor: amount }],
});
const summary = (): OwnerSummaryDto =>
  ({
    sourceVersion: 'owner-cash-foundation-v1',
    generatedAt: '2026-10-21T16:06:00Z',
    state: 'READY',
    scope: { locationId: 'l', organizationId: 'o', vertical: 'BEAUTY' },
    period: {
      key: 'today',
      timezone: 'Asia/Almaty',
      fromDate: '2026-10-21',
      toDate: '2026-10-21',
      fromUtc: '2026-10-20T19:00:00Z',
      toUtc: '2026-10-21T16:06:00Z',
      isFinalized: false,
    },
    current: {
      revenue: money('164000000'),
      receipts: money('148000000'),
      paidExpenses: {
        state: 'READY',
        reason: null,
        unresolvedSources: 0,
        currencies: [
          {
            currency: 'KZT',
            amountMinor: '31000000',
            paidMinor: '31000000',
            categories: [{ categoryId: 'c1', categoryName: 'Аренда', paidMinor: '31000000' }],
          },
        ],
      },
    },
    previous: null,
    comparisonReason: 'COMPARABLE_PROJECTION_NOT_CONNECTED',
    classificationReason: null,
    workload: {
      state: 'COMPLETE',
      reason: null,
      basis: 'BOOKED_SCHEDULE',
      unit: 'EMPLOYEE_MINUTE',
      numerator: '64',
      denominator: '100',
      percent: 64,
      coverage: [],
    },
  }) as unknown as OwnerSummaryDto;

const html = (s = summary()) =>
  renderToStaticMarkup(createElement(OwnerSummaryView, { summary: s }));

describe('Главная на одном экране', () => {
  it('шапка одной строкой: заголовок, период и кнопки в одном ряду, без отдельной строки «Обзор бизнеса»', () => {
    const h = html();
    const bar = h.match(/<header class="owner-bar">([\s\S]*?)<\/header>/)?.[1] ?? '';
    expect(bar).toContain('<h1>Главная</h1>');
    expect(bar).toContain('aria-label="Период отчёта"');
    expect(bar).toContain('Рабочий день');
    expect(bar).toContain('Отчёт за период');
    expect(h).not.toContain('owner-toolbar');
    expect(h).not.toContain('owner-eyebrow');
  });
  it('итоги строкой: четыре показателя в одной полосе, без плиток-статей', () => {
    const h = html();
    const totals =
      h.match(/<section class="owner-panel owner-totals"[^>]*>([\s\S]*?)<\/section>/)?.[1] ?? '';
    for (const label of ['Выручка', 'Поступления', 'Оплаченные расходы', 'Загрузка сегодня'])
      expect(totals).toContain(label);
    expect(totals).not.toContain('<article');
    expect(h).not.toContain('owner-kpis');
  });
  it('«Куда уходят деньги» справа рядом с графиком, а не отдельной полосой внизу', () => {
    const h = html();
    const side = h.match(/<aside class="owner-side"[^>]*>([\s\S]*)<\/aside>/)?.[1] ?? '';
    expect(side).toContain('Требуют решения');
    expect(side).toContain('Куда уходят деньги');
    expect(side).toContain('Аренда');
    expect(h.indexOf('Куда уходят деньги')).toBeGreaterThan(h.indexOf('Динамика по дням'));
  });
  it('«Требуют решения» короткими строками со ссылкой, без отдельных карточек', () => {
    const h = html();
    expect(h).toContain('class="owner-todo"');
    expect(h).not.toContain('owner-decision');
  });
  it('сжатые отступы: высота графика и полей рассчитаны на экран ноутбука', () => {
    const css = readFileSync('apps/web/src/app/today/unified-owner.css', 'utf8');
    expect(css).toMatch(/\.owner-chart-plot\s*\{[^}]*height:\s*200px/);
    expect(css).toMatch(/\.owner-home\s*\{[^}]*padding:\s*var\(--space-4\)/);
  });
});
