import { describe, expect, it } from 'vitest';
import { customerSegment } from './customer-filter';

/** Аудит 21.10.2026 п.11: карточка и список называют клиента одним сегментом */
describe('сегмент клиента салона', () => {
  it('меньше двух визитов это «Новый», от двух «Постоянный», архив отдельно', () => {
    expect(customerSegment({ status: 'ACTIVE', visits: 0 }).label).toBe('Новый');
    expect(customerSegment({ status: 'ACTIVE', visits: 2 }).label).toBe('Постоянный');
    expect(customerSegment({ status: 'ARCHIVED', visits: 5 }).label).toBe('В архиве');
  });
});
