import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import type { SalesRepository } from './sales.repository';
import { SalesService } from './sales.service';
import type { Period, PeriodTotals } from './sales-summary';

class FakeRepository implements SalesRepository {
  calls: Period[] = [];
  async totals(period: Period): Promise<PeriodTotals> {
    this.calls.push(period);
    // прошлый отрезок идёт раньше текущего: отличаем по дате начала
    return period.from === '2026-10-08'
      ? { offered: 4, booked: 2, revenueMinor: 5_000_00n, currency: 'KZT' }
      : { offered: 2, booked: 1, revenueMinor: 1_000_00n, currency: 'KZT' };
  }
  async competitors() {
    return { count: 3, lastObservedOn: '2026-10-09' };
  }
}

describe('хаб «Продажи»: сервис', () => {
  it('считает текущий и прошлый отрезок одной сводкой', async () => {
    const repo = new FakeRepository();
    const s = await new SalesService(repo).summary('2026-10-08', '2026-10-14');
    expect(repo.calls).toEqual([
      { from: '2026-10-08', to: '2026-10-14' },
      { from: '2026-10-01', to: '2026-10-07' },
    ]);
    expect(s.bookings).toEqual({ current: 2, previous: 1 });
    expect(s.conversionPermille).toEqual({ current: 500, previous: 500 });
    expect(s.competitors.count).toBe(3);
  });

  it('неверный период отклоняется до обращения к базе', async () => {
    const repo = new FakeRepository();
    await expect(new SalesService(repo).summary('2026-10-14', '2026-10-08')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repo.calls).toEqual([]);
  });
});
