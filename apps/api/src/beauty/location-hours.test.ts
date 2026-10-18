import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.provider';
vi.mock('./scope', () => ({ mayBeautyWrite: vi.fn(), beautyScope: vi.fn(), beautyTransaction: vi.fn() }));
import { BeautyLocationHoursService } from './location-hours';

describe('salon hours input errors', () => {
  for (const intervals of [null, {}, [{ weekday: 1, timeFrom: '18:00', timeTo: '09:00' }]]) {
    it(`reports malformed intervals as client input rather than a revision conflict (${JSON.stringify(intervals)})`, async () => {
      await expect(new BeautyLocationHoursService({} as PrismaService).save({ expectedRevision: 0, intervals }))
        .rejects.toBeInstanceOf(BadRequestException);
    });
  }
});
