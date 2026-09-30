import 'reflect-metadata';
import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ChessboardService } from './chessboard.service';
import { Access } from '../auth/access.decorator';

@Access('desk')
@Controller()
export class ChessboardController {
  constructor(@Inject(ChessboardService) private readonly service: ChessboardService) {}

  /** Шахматка: ячейки × даты, только чтение. ?from=YYYY-MM-DD&to=YYYY-MM-DD (≤ 62 дней). */
  @Get('chessboard')
  board(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.board(from || undefined, to || undefined);
  }

  /** Доступность по категориям: ?arrival=YYYY-MM-DD&departure=YYYY-MM-DD (по умолчанию сегодня → завтра). */
  @Get('availability')
  availability(@Query('arrival') arrival?: string, @Query('departure') departure?: string) {
    return this.service.availability(arrival || undefined, departure || undefined);
  }

  /**
   * Ближайшая доступность для «Свободных мест» (AV4): ?arrival&departure&guests[&days=14] — по категории первое
   * окно того же срока, где хватает мест; null — не нашлось за `days` дней.
   */
  @Get('availability/nearest')
  nearest(
    @Query('arrival') arrival?: string,
    @Query('departure') departure?: string,
    @Query('guests') guests?: string,
    @Query('days') days?: string,
  ) {
    return this.service.nearest(arrival, departure, guests, days);
  }

  /** Карточка брони по номеру подтверждения. */
  @Get('reservations/:number')
  reservation(@Param('number') number: string) {
    return this.service.reservation(number);
  }
}
