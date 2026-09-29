import { describe, expect, it } from 'vitest';
import type { ChessboardAllocation, ChessboardUnit } from '../chessboard/index';
import { nearestAvailability, sellableStay } from './nearest';

// ТЗ «Свободные места» §7, AV4 (ADR-110): «С 1-го нет, но есть с 3-го» — тот же срок, сдвинутый вперёд
const unit = (id: string, kind: 'ROOM' | 'BED', category: string): ChessboardUnit => ({
  id,
  code: id,
  kind,
  accommodationTypeCode: category,
  accommodationTypeName: category,
});
const stay = (unitId: string, startDate: string, endDate: string): ChessboardAllocation => ({
  unitId,
  startDate,
  endDate,
  itemId: `i-${unitId}-${startDate}`,
  itemStatus: 'CONFIRMED',
  confirmationNumber: `B-${unitId}`,
  guestLabel: 'Гость Тест',
});
const units = [unit('R1', 'ROOM', 'room'), unit('B1', 'BED', 'dorm'), unit('B2', 'BED', 'dorm')];

describe('ближайшая доступность', () => {
  it('номер занят на запрошенные даты — первая дата заезда, с которой свободен тот же срок', () => {
    const out = nearestAvailability({
      arrivalDate: '2026-10-01',
      departureDate: '2026-10-04',
      days: 14,
      need: { room: 1 },
      units,
      allocations: [stay('R1', '2026-09-30', '2026-10-06')],
      blocks: [],
      sold: [],
    });
    // выезд 06-го не занимает ночь: с 06-го на три ночи свободно
    expect(out).toEqual({ room: { arrivalDate: '2026-10-06', departureDate: '2026-10-09' } });
  });

  it('койки: свободных должно хватить на всех гостей; свободно на запрошенные даты — те же даты', () => {
    const out = nearestAvailability({
      arrivalDate: '2026-10-01',
      departureDate: '2026-10-03',
      days: 14,
      need: { dorm: 2, room: 1 },
      units,
      allocations: [stay('B1', '2026-10-01', '2026-10-02')],
      blocks: [],
      sold: [],
    });
    expect(out).toEqual({
      dorm: { arrivalDate: '2026-10-02', departureDate: '2026-10-04' },
      room: { arrivalDate: '2026-10-01', departureDate: '2026-10-03' },
    });
  });

  it('блокировка и проданное без ячейки (Q-107) занимают место так же, как в GET /availability', () => {
    const out = nearestAvailability({
      arrivalDate: '2026-10-01',
      departureDate: '2026-10-02',
      days: 14,
      need: { room: 1, dorm: 2 },
      units,
      allocations: [],
      blocks: [{ unitId: 'R1', dateFrom: '2026-10-01', dateTo: '2026-10-03', type: 'MAINTENANCE' }],
      sold: [
        { accommodationTypeCode: 'dorm', arrivalDate: '2026-10-01', departureDate: '2026-10-05' },
      ],
    });
    expect(out).toEqual({
      room: { arrivalDate: '2026-10-03', departureDate: '2026-10-04' },
      dorm: { arrivalDate: '2026-10-05', departureDate: '2026-10-06' },
    });
  });

  it('за глубину поиска мест нет — null; категорий больше, чем мест, не бывает', () => {
    const out = nearestAvailability({
      arrivalDate: '2026-10-01',
      departureDate: '2026-10-02',
      days: 3,
      need: { room: 1, dorm: 3 },
      units,
      allocations: [stay('R1', '2026-09-01', '2026-11-01')],
      blocks: [],
      sold: [],
    });
    expect(out).toEqual({ room: null, dorm: null });
  });

  it('sellableStay — та же доступность, что отдаёт GET /availability (свободные ячейки, не больше остатка канала)', () => {
    const s = sellableStay({
      arrivalDate: '2026-10-01',
      departureDate: '2026-10-02',
      units,
      allocations: [],
      blocks: [],
      sold: [
        { accommodationTypeCode: 'dorm', arrivalDate: '2026-10-01', departureDate: '2026-10-02' },
      ],
    });
    // ячейки свободны обе, но одно место канал уже продал без ячейки
    expect(s.byCategory['dorm']).toEqual({
      units: 2,
      available: 1,
      availableUnitCodes: ['B1', 'B2'],
    });
    expect(s.byCategory['room']?.available).toBe(1);
  });
});
