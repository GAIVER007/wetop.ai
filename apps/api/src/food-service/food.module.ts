import 'reflect-metadata';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Module,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Access } from '../auth/access.decorator';
import { RequiresBusinessCapability } from '../auth/capability.decorator';
import { PrismaService } from '../database/prisma.provider';
import { FoodService } from './food.service';
@Controller('food-service')
@Access('desk')
@RequiresBusinessCapability('food.tables')
export class FoodCatalogController {
  constructor(@Inject(FoodService) private readonly service: FoodService) {}
  @Get('areas') areas(@Query() q: Record<string, unknown>) {
    return this.service.catalog('area', q);
  }
  @Post('areas') @Access('property') createArea(@Body() b: unknown) {
    return this.service.createCatalog('area', b);
  }
  @Patch('areas/:id') @Access('property') updateArea(@Param('id') id: string, @Body() b: unknown) {
    return this.service.updateCatalog('area', id, b);
  }
  @Get('tables') tables(@Query() q: Record<string, unknown>) {
    return this.service.catalog('table', q);
  }
  @Post('tables') @Access('property') createTable(@Body() b: unknown) {
    return this.service.createCatalog('table', b);
  }
  @Patch('tables/:id') @Access('property') updateTable(
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.updateCatalog('table', id, b);
  }
  @Get('service-periods') periods(@Query() q: Record<string, unknown>) {
    return this.service.catalog('period', q);
  }
  @Post('service-periods') @Access('property') createPeriod(@Body() b: unknown) {
    return this.service.createCatalog('period', b);
  }
  @Patch('service-periods/:id') @Access('property') updatePeriod(
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.updateCatalog('period', id, b);
  }
}
@Controller('food-service')
@Access('desk')
@RequiresBusinessCapability('food.tableReservations')
export class FoodReservationsController {
  constructor(@Inject(FoodService) private readonly service: FoodService) {}
  @Get('customers') customers(@Query() q: Record<string, unknown>) {
    return this.service.customers(q);
  }
  @Get('reservations') list(@Query() q: Record<string, unknown>) {
    return this.service.reservations(q);
  }
  @Post('reservations') create(@Headers('idempotency-key') key: unknown, @Body() b: unknown) {
    return this.service.create(key, b);
  }
  @Patch('reservations/:id') update(@Param('id') id: string, @Body() b: unknown) {
    return this.service.update(id, b);
  }
  @Post('reservations/:id/status') status(@Param('id') id: string, @Body() b: unknown) {
    return this.service.status(id, b);
  }
  @Put('reservations/:id/table') assign(@Param('id') id: string, @Body() b: unknown) {
    return this.service.assign(id, b);
  }
  @Delete('reservations/:id/table') unassign(@Param('id') id: string, @Body() b: unknown) {
    return this.service.unassign(id, b);
  }
}
@Module({
  controllers: [FoodCatalogController, FoodReservationsController],
  providers: [PrismaService, FoodService],
  exports: [FoodService],
})
export class FoodModule {}
