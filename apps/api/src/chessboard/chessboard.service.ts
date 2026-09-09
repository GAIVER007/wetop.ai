import 'reflect-metadata';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  MAX_CHESSBOARD_DAYS,
  availableUnitsForStay,
  buildChessboard,
  dateRange,
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
    if (dateRange(from, to).length > MAX_CHESSBOARD_DAYS)
      throw new BadRequestException(`Максимум ${MAX_CHESSBOARD_DAYS} дней за запрос`);
    const [units, allocations, blocks] = await Promise.all([
      this.repo.units(),
      this.repo.allocations(from, to),
      this.repo.blocks(from, to),
    ]);
    return buildChessboard({ from, to, units, allocations, blocks });
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
    if (dateRange(arrival, lastNight).length > MAX_CHESSBOARD_DAYS)
      throw new BadRequestException(`Максимум ${MAX_CHESSBOARD_DAYS} ночей`);
    const [units, allocations, blocks] = await Promise.all([
      this.repo.units(),
      this.repo.allocations(arrival, lastNight),
      this.repo.blocks(arrival, lastNight),
    ]);
    return availableUnitsForStay({
      arrivalDate: arrival,
      departureDate: departure,
      units,
      allocations,
      blocks,
    });
  }

  async reservation(number: string): Promise<ReservationCard> {
    const r = await this.repo.reservation(number);
    if (!r) throw new NotFoundException(`Бронь ${number} не найдена`);
    return r;
  }
}
