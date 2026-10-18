import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../database/prisma.provider';
import { BeautyReviewsService } from './reviews';

describe('Beauty review submission validation', () => {
  for (const stars of [true, '5', null]) {
    it(`rejects a nonnumeric stars value (${typeof stars}) before database access`, async () => {
      const service = new BeautyReviewsService({} as PrismaService);
      await expect(
        service.submit(
          'x'.repeat(43),
          {
            reviews: [{ masterKey: 'a'.repeat(64), stars }],
          },
          { ip: null },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  }
});
