import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import { SALES_REPOSITORY, type SalesRepository } from './sales.repository';
import { buildSalesSummary, parsePeriod, previousPeriod } from './sales-summary';

@Injectable()
export class SalesService {
  constructor(@Inject(SALES_REPOSITORY) private readonly repository: SalesRepository) {}

  async summary(from: unknown, to: unknown) {
    const period = parsePeriod(from, to);
    const [current, previous, competitors] = await Promise.all([
      this.repository.totals(period),
      this.repository.totals(previousPeriod(period.from, period.to)),
      this.repository.competitors(),
    ]);
    return buildSalesSummary({ period, current, previous, competitors });
  }
}
