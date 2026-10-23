import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { OwnerSummaryView } from './unified-owner';
import type { OwnerAttentionItem, OwnerSummaryDto } from '../../lib/owner-summary';

/** «Требуют решения» (решение 21.10.2026): настоящие дела дня от API вместо двух общих строк о расчётах */
const money = { state: 'READY' as const, reason: null, currencies: [{ currency: 'KZT', amountMinor: '100' }] };
const summary = (attention: OwnerAttentionItem[] | undefined, vertical = 'BEAUTY'): OwnerSummaryDto =>
  ({
    sourceVersion: 'owner-cash-foundation-v1',
    generatedAt: '2026-10-21T07:00:00Z',
    state: 'PARTIAL',
    scope: { locationId: 'l', organizationId: 'o', vertical },
    period: { key: 'week', timezone: 'Asia/Almaty', fromDate: '2026-10-15', toDate: '2026-10-21', fromUtc: '', toUtc: '', isFinalized: false },
    current: { revenue: money, receipts: money, paidExpenses: { state: 'READY', reason: null, currencies: [] } },
    previous: null,
    comparisonReason: null,
    classificationReason: null,
    workload: { state: 'UNAVAILABLE', reason: null, numerator: null, denominator: null, coverage: [] },
    attention,
  }) as unknown as OwnerSummaryDto;
const block = (s: OwnerSummaryDto) =>
  renderToStaticMarkup(createElement(OwnerSummaryView, { summary: s })).match(/<ul class="owner-todo"[^>]*>([\s\S]*?)<\/ul>/)?.[1] ?? '';

describe('«Требуют решения» на Главной', () => {
  it('строки от API: текст, ссылка с действием, тон и число', () => {
    const html = block(summary([
      { id: 'unpaid-visits', tone: 'warn', count: 2, text: 'Не оплачено сегодня: 2 записи', href: '/calendar', action: 'Журнал' },
      { id: 'free-windows', tone: 'warn', count: 3, text: 'Свободные окна: 3 мастера', href: '/calendar', action: 'Журнал' },
    ]));
    expect(html).toContain('<li data-state="warn" data-testid="owner-attention-unpaid-visits"><span title="Не оплачено сегодня: 2 записи">Не оплачено сегодня: 2 записи</span><a href="/calendar">Журнал</a></li>');
    expect(html).toContain('Свободные окна: 3 мастера');
    expect(html).not.toContain('Загрузка рассчитана');
    expect(html).not.toContain('Проверить загрузку');
  });
  it('дел нет: одна спокойная строка', () => {
    const html = block(summary([{ id: 'all-clear', tone: 'ok', text: 'Срочных дел нет', href: '/today/operations', action: 'Открыть день' }]));
    expect(html).toContain('data-state="ok"');
    expect(html).toContain('Срочных дел нет');
    expect((html.match(/<li/g) ?? []).length).toBe(1);
  });
  it('не больше 4 строк, даже если API прислал больше', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ id: `x${i}`, tone: 'warn' as const, text: `Дело ${i}`, href: '/calendar', action: 'Открыть' }));
    expect((block(summary(many)).match(/<li/g) ?? []).length).toBe(4);
  });
  it('ссылка на финансы получает выбранный период, как остальные ссылки отчёта', () => {
    const html = block(summary([{ id: 'unclassified-expenses', tone: 'warn', text: 'Есть расходы без статьи', href: '/restaurant-finance', action: 'Разобрать' }], 'FOOD_SERVICE'));
    expect(html).toContain('href="/restaurant-finance?from=2026-10-15&amp;to=2026-10-21"');
  });
  it('старый ответ API без списка и пустой список: честная строка без выдуманных дел', () => {
    for (const a of [undefined, []]) {
      const html = block(summary(a));
      expect(html).toContain('Дела дня не загрузились, откройте рабочий день');
      expect(html).toContain('href="/today/operations"');
    }
  });
  it('строка в одну линию с многоточием, без длинного тире в новом тексте', () => {
    const css = readFileSync('apps/web/src/app/today/unified-owner.css', 'utf8');
    expect(css).toMatch(/\.owner-todo span\s*\{[^}]*text-overflow:\s*ellipsis/);
    expect(css).toMatch(/\.owner-todo span\s*\{[^}]*white-space:\s*nowrap/);
    const src = readFileSync('apps/web/src/app/today/unified-owner.tsx', 'utf8');
    expect(src.slice(src.indexOf('owner-attention-title'))).not.toContain('\u2014');
  });
});
