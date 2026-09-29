import 'reflect-metadata';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  MAX_CHESSBOARD_DAYS,
  NEAREST_DAYS_DEFAULT,
  buildChessboard,
  daySpan,
  nearestAvailability,
  sellableStay,
  type Chessboard,
  type NearestStay,
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
    const today = await this.repo.today();
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
    const today = await this.repo.today();
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
    // Q-107: остаток стойки не больше остатка канала — проживания без ячейки уже проданы
    return sellableStay({
      arrivalDate: arrival,
      departureDate: departure,
      units,
      allocations,
      blocks,
      sold,
    });
  }

  /**
   * Ближайшая доступность (ADR-110, ТЗ «Свободные места» §7, AV4): для каждой категории — первое окно того же
   * срока с заездом от `arrival` до `arrival + days`, где продать можно на весь запрос (номер — один на всех,
   * койки — по одной на гостя). Каждое окно считается как `GET /availability`; данные читаются один раз.
   */
  async nearest(
    arrival?: string,
    departure?: string,
    guestsRaw?: string,
    daysRaw?: string,
  ): Promise<{
    arrivalDate: string;
    departureDate: string;
    guests: number;
    days: number;
    byCategory: Record<string, NearestStay>;
  }> {
    if (
      !arrival ||
      !departure ||
      !ISO.test(arrival) ||
      !ISO.test(departure) ||
      Number.isNaN(Date.parse(arrival)) ||
      Number.isNaN(Date.parse(departure)) ||
      departure <= arrival
    )
      throw new BadRequestException(
        'arrival/departure должны быть датами YYYY-MM-DD, departure > arrival',
      );
    const lastNight = plusDays(departure, -1);
    if (daySpan(arrival, lastNight) > MAX_CHESSBOARD_DAYS)
      throw new BadRequestException(`Максимум ${MAX_CHESSBOARD_DAYS} ночей`);
    const guests = Number(guestsRaw ?? '1');
    if (!Number.isInteger(guests) || guests < 1 || guests > 99)
      throw new BadRequestException('guests — целое от 1 до 99');
    // глубина — параметр экрана, не правило продажи (ТЗ §7); предел — чтобы запрос оставался дешёвым
    const days = Number(daysRaw ?? NEAREST_DAYS_DEFAULT);
    if (!Number.isInteger(days) || days < 1 || days > 31)
      throw new BadRequestException('days — целое от 1 до 31');
    const [units, allocations, blocks, sold] = await Promise.all([
      this.repo.units(),
      this.repo.allocations(arrival, plusDays(lastNight, days)),
      this.repo.blocks(arrival, plusDays(lastNight, days)),
      this.repo.soldStays(arrival, plusDays(departure, days)),
    ]);
    const need: Record<string, number> = {};
    for (const u of units) need[u.accommodationTypeCode] = u.kind === 'BED' ? guests : 1;
    return {
      arrivalDate: arrival,
      departureDate: departure,
      guests,
      days,
      byCategory: nearestAvailability({
        arrivalDate: arrival,
        departureDate: departure,
        days,
        need,
        units,
        allocations,
        blocks,
        sold,
      }),
    };
  }

  async reservation(number: string): Promise<ReservationCard> {
    const r = await this.repo.reservation(number);
    if (!r) throw new NotFoundException(`Бронь ${number} не найдена`);
    return r;
  }
}
