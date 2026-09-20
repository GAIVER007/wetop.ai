import 'reflect-metadata';
import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ReservationsService,
  type AssignUnitDto,
  type ChangeDatesDto,
  type CreateReservationDto,
  type UpdateItemDto,
  type UpdateReservationDto,
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

  /** Правка шапки готовой брони: заметки и источник (даты и ячейки — отдельными командами) */
  @Patch(':number')
  update(@Param('number') number: string, @Body() dto: UpdateReservationDto) {
    return this.service.update(number, dto ?? {});
  }

  /** Гостей на проживании (Q-102): вместимость категории проверяется как при создании */
  @Patch(':number/items/:itemId')
  updateItem(
    @Param('number') number: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.service.updateItem(number, itemId, dto ?? {});
  }

  @Post(':number/cancel')
  @HttpCode(200)
  cancel(@Param('number') number: string) {
    return this.service.cancel(number);
  }

  @Post(':number/items/:itemId/check-in')
  @HttpCode(200)
  checkIn(@Param('number') number: string, @Param('itemId') itemId: string) {
    return this.service.checkIn(number, itemId);
  }

  @Post(':number/items/:itemId/check-out')
  @HttpCode(200)
  checkOut(
    @Param('number') number: string,
    @Param('itemId') itemId: string,
    @Body() dto: { withDebt?: boolean },
  ) {
    return this.service.checkOut(number, itemId, dto ?? {});
  }

  @Post(':number/items/:itemId/no-show')
  @HttpCode(200)
  noShow(@Param('number') number: string, @Param('itemId') itemId: string) {
    return this.service.noShow(number, itemId);
  }

  @Post(':number/items/:itemId/extend')
  @HttpCode(200)
  extend(
    @Param('number') number: string,
    @Param('itemId') itemId: string,
    @Body() dto: { nights?: number; ratePlanCode?: string },
  ) {
    return this.service.extend(number, itemId, dto ?? {});
  }

  /**
   * Сколько будет стоить действие — до подтверждения (срез 7.3, Д5). Только чтение: ничего не
   * пишется, каналы не трогаются. `action`: move (нужен unitCode) | extend (nights) | cancel | no_show.
   */
  @Get(':number/items/:itemId/preview')
  preview(
    @Param('number') number: string,
    @Param('itemId') itemId: string,
    @Query() q: { action?: string; unitCode?: string; nights?: string; ratePlanCode?: string },
  ) {
    return this.service.preview(number, itemId, q ?? {});
  }

  // ── Предпросмотр сумм до подтверждения (срез 7.3, Д5): только чтение теми же функциями ──
  @Get(':number/items/:itemId/move-preview')
  movePreview(
    @Param('number') number: string,
    @Param('itemId') itemId: string,
    @Query('unitCode') unitCode?: string,
    @Query('ratePlanCode') ratePlanCode?: string,
  ) {
    return this.service.previewMove(number, itemId, { unitCode, ratePlanCode });
  }

  @Get(':number/items/:itemId/extend-preview')
  extendPreview(
    @Param('number') number: string,
    @Param('itemId') itemId: string,
    @Query('nights') nights?: string,
    @Query('ratePlanCode') ratePlanCode?: string,
  ) {
    return this.service.previewExtend(number, itemId, { nights, ratePlanCode });
  }

  @Get(':number/cancel-preview')
  cancelPreview(
    @Param('number') number: string,
    @Query('reason') reason?: string,
    @Query('itemId') itemId?: string,
  ) {
    return this.service.previewCancel(number, { reason, itemId });
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
