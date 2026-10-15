import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { expect, it } from 'vitest';
import { BarController } from './bar.controller';
import { BarService } from './bar.service';
import { BarScanService } from './bar-scan.service';

it('loads every empty Bar section without compiler-emitted constructor metadata, as in tsx production', async () => {
  const metadata = Reflect.getOwnMetadata('design:paramtypes', BarController);
  Reflect.deleteMetadata('design:paramtypes', BarController);
  const sections = ['categories', 'products', 'suppliers', 'receipts', 'stock', 'sales', 'folios', 'movements'];
  const service = Object.fromEntries(sections.map(section => [section, async () => []]));
  const report = { purchasesMinor: '0', supplierPaidMinor: '0', revenueMinor: '0', costMinor: '0', grossProfitMinor: '0', writeOffMinor: '0', stockCostMinor: '0', supplierDebtMinor: '0' };
  try {
    const module = await Test.createTestingModule({
      controllers: [BarController],
      providers: [
        { provide: BarService, useValue: { ...service, report: async () => report } },
        { provide: BarScanService, useValue: {} },
      ],
    }).compile();
    const app = module.createNestApplication({ logger: false });
    try {
      await app.init();
      for (const section of sections) {
        const response = await request(app.getHttpServer()).get(`/bar/${section}`);
        expect(response.status, section).toBe(200);
        expect(response.body, section).toEqual([]);
      }
      const response = await request(app.getHttpServer()).get('/bar/report');
      expect(response.status).toBe(200);
      expect(response.body).toEqual(report);
    } finally {
      await app.close();
    }
  } finally {
    if (metadata !== undefined) Reflect.defineMetadata('design:paramtypes', metadata, BarController);
  }
});
