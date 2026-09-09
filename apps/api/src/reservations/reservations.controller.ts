import 'reflect-metadata';
import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post } from '@nestjs/common';
import {
  ReservationsService,
  type AssignUnitDto,
  type ChangeDatesDto,
  type CreateReservationDto,
} from './reservations.service';

/** Команды ручной брони (стойка). Чтение — в ChessboardController (GET /reservations/:number). */
@Controller('reservations')
export class ReservationsController {
  constructor(@Inject(ReservationsService) private readonly service: ReservationsService) {}

  @Post()
  create(@Body() dto: CreateReservationDto) {
    return this.service.create(dto ?? {});
  }

  @Patch(':number/dates')
  changeDates(@Param('number') number: string, @Body() dto: ChangeDatesDto) {
    return this.service.changeDates(number, dto ?? {});
  }

  @Post(':number/cancel')
  @HttpCode(200)
  cancel(@Param('number') number: string) {
    return this.service.cancel(number);
  }

  @Post(':number/items/:itemId/assign')
  @HttpCode(200)
  assign(
    @Param('number') number: string,
    @Param('itemId') itemId: string,
    @Body() dto: AssignUnitDto,
  ) {
    return this.service.assign(number, itemId, dto ?? {});
  }
}

/** Справочник активных тарифов для формы брони. Отдельный префикс: /reservations/:number занят чтением карточки. */
@Controller('rate-plans')
export class RatePlansController {
  constructor(@Inject(ReservationsService) private readonly service: ReservationsService) {}

  @Get()
  list() {
    return this.service.ratePlans();
  }
}
