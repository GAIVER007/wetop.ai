import 'reflect-metadata';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  MAX_CHESSBOARD_DAYS,
  availableUnitsForStay,
  capStayAvailability,
  categoryAvailability,
  buildChessboard,
  daySpan,
  type Chessboard,
  type StayAvailability,
} from '@pms/domain';
import {
  CHESSBOARD_REPOSITORY,
  type ChessboardRepository,
  type ReservationCard,
} from './chessboard.repository';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const plusDays = (iso: string, n: number) => {
  const x = new Date(`${iso}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

@Injectable()
export class ChessboardService {
  constructor(@Inject(CHESSBOARD_REPOSITORY) private readonly repo: ChessboardRepository) {}

  /** Диапазон по умолчанию — сегодня (Asia/Almaty) + 14 дней. */
  async board(fromRaw?: string, toRaw?: string): Promise<Chessboard> {
    const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
    const from = fromRaw ?? today;
    const to = toRaw ?? plusDays(from, 14);
    if (
      !ISO.test(from) ||
      !ISO.test(to) ||
      Number.isNaN(Date.parse(from)) ||
      Number.isNaN(Date.parse(to)) ||
      from > to
    ) {
      throw new BadRequestException('from/to должны быть датами YYYY-MM-DD, from ≤ to');
    }
    if (daySpan(from, to) > MAX_CHESSBOARD_DAYS)
      throw new BadRequestException(`Максимум ${MAX_CHESSBOARD_DAYS} дней за запрос`);
    // Строка «Без ячейки»: ночи доски — [from, to], т.е. полуинтервал [from, to + 1)
    const [units, allocations, blocks, unassigned] = await Promise.all([
      this.repo.units(),
      this.repo.allocations(from, to),
      this.repo.blocks(from, to),
      this.repo.unassignedStays(from, plusDays(to, 1)),
    ]);
    return buildChessboard({ from, to, units, allocations, blocks, unassigned });
  }

  /** Доступность ячеек по категориям для проживания [arrival, departure). */
  async availability(arrivalRaw?: string, departureRaw?: string): Promise<StayAvailability> {
    const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
    const arrival = arrivalRaw ?? today;
    const departure = departureRaw ?? plusDays(arrival, 1);
    if (
      !ISO.test(arrival) ||
      !ISO.test(departure) ||
      Number.isNaN(Date.parse(arrival)) ||
      Number.isNaN(Date.parse(departure)) ||
      departure <= arrival
    ) {
      throw new BadRequestException(
        'arrival/departure должны быть датами YYYY-MM-DD, departure > arrival',
      );
    }
    const lastNight = plusDays(departure, -1);
    if (daySpan(arrival, lastNight) > MAX_CHESSBOARD_DAYS)
      throw new BadRequestException(`Максимум ${MAX_CHESSBOARD_DAYS} ночей`);
    const [units, allocations, blocks, sold] = await Promise.all([
      this.repo.units(),
      this.repo.allocations(arrival, lastNight),
      this.repo.blocks(arrival, lastNight),
      this.repo.soldStays(arrival, departure),
    ]);
    const stay = availableUnitsForStay({
      arrivalDate: arrival,
      departureDate: departure,
      units,
      allocations,
      blocks,
    });
    // Q-107: остаток стойки не больше остатка канала — проживания без ячейки уже проданы
    const unitCategory = new Map(units.map((u) => [u.id, u.accommodationTypeCode]));
    const byCategory = new Map<string, number>();
    for (const u of units)
      byCategory.set(u.accommodationTypeCode, (byCategory.get(u.accommodationTypeCode) ?? 0) + 1);
    const perNight = categoryAvailability({
      from: arrival,
      to: lastNight,
      units: [...byCategory].map(([code, active]) => ({ code, active })),
      blocks: blocks.map((b) => ({
        accommodationTypeCode: unitCategory.get(b.unitId) ?? '',
        dateFrom: b.dateFrom,
        dateTo: b.dateTo,
      })),
      items: sold,
    });
    return capStayAvailability(stay, perNight);
  }

  async reservation(number: string): Promise<ReservationCard> {
    const r = await this.repo.reservation(number);
    if (!r) throw new NotFoundException(`Бронь ${number} не найдена`);
    return r;
  }
}
