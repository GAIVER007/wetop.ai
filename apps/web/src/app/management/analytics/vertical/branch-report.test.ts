import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BranchReport } from './branch-report';

/** Правило владельца 21.10.2026: без плиток над списком. Статусы один раз, полосками с числами. */
describe('отчёт филиала в аналитике', () => {
  it('статусы без плиток, числа в полосках', () => {
    const html = renderToStaticMarkup(
      BranchReport({
        labels: { BOOKED: 'Запланировано', DONE: 'Завершено' },
        counts: { BOOKED: 2, DONE: 1 },
        revenue: { KZT: '1200000' },
      }),
    );
    expect(html).not.toContain('class="stat');
    expect(html).not.toContain('Статусы за период');
    expect(html).toMatch(/data-testid="period-BOOKED"[^>]*>2</);
    expect(html).toMatch(/data-testid="period-DONE"[^>]*>1</);
  });
  it('пустой период: нули остаются доступны по testid', () => {
    const html = renderToStaticMarkup(
      BranchReport({ labels: { BOOKED: 'Запланировано' }, counts: {}, revenue: {} }),
    );
    expect(html).toMatch(/data-testid="period-BOOKED"[^>]*>0</);
  });
});
