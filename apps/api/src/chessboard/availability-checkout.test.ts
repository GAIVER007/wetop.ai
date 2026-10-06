import { expect, it, vi } from 'vitest';
import { PrismaChessboardRepository } from './chessboard.repository';
import { ChessboardService } from './chessboard.service';
import type { PrismaService } from '../database/prisma.provider';

vi.mock('../database/property-ref', () => ({
  propertyIdRef: async () => 'test-property',
  propertyToday: async () => '2026-10-04',
}));

it.each([
  ['CHECKED_OUT', [], 88, 4],
  ['CONFIRMED', [], 86, 2],
  ['CHECKED_OUT', ['2026-10-06'], 86, 2],
] as const)(
  'счётчики формы и свободных мест: %s, назначения %j',
  async (status, ends, total, category) => {
    const db = {
      reservationItem: {
        findMany: vi.fn().mockResolvedValue(
          Array.from({ length: 2 }, () => ({
            status,
            arrivalDate: new Date('2026-10-04T00:00:00Z'),
            departureDate: new Date('2026-10-08T00:00:00Z'),
            accommodationType: { code: 'single' },
            allocations: ends.map((endDate) => ({ endDate: new Date(`${endDate}T00:00:00Z`) })),
          })),
        ),
      },
    };
    const repo = new PrismaChessboardRepository({ db } as unknown as PrismaService);
    vi.spyOn(repo, 'units').mockResolvedValue(
      Array.from({ length: 88 }, (_, i) => ({
        id: `unit-${i}`,
        code: `${i}`,
        kind: 'ROOM',
        accommodationTypeCode: i < 4 ? 'single' : 'other',
        accommodationTypeName: 'Тестовая категория',
      })),
    );
    vi.spyOn(repo, 'allocations').mockResolvedValue([]);
    vi.spyOn(repo, 'blocks').mockResolvedValue([]);
    const service = new ChessboardService(repo);
    for (let reload = 0; reload < 2; reload += 1) {
      const result = await service.availability('2026-10-04', '2026-10-06');
      expect(result.total).toEqual({ units: 88, available: total });
      expect(result.byCategory.single!.available).toBe(category);
      expect(result.byCategory.single!.availableUnitCodes).toHaveLength(4);
      expect(Object.values(result.byCategory).reduce((sum, c) => sum + c.available, 0)).toBe(total);
    }
    if (status === 'CHECKED_OUT') {
      expect((await service.availability('2026-10-08', '2026-10-10')).total.available).toBe(88);
    }
  },
);
