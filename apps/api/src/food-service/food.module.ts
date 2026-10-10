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
import { RestaurantService } from './restaurant.service';
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
@Controller('food-service')
@Access('desk')
@RequiresBusinessCapability('food.menu')
export class FoodMenuController {
  constructor(@Inject(RestaurantService) private readonly service: RestaurantService) {}
  @Get('menu/categories') categories(@Query() q: Record<string, unknown>) {
    return this.service.categories(q);
  }
  @Post('menu/categories') @Access('property') createCategory(@Body() b: unknown) {
    return this.service.createCategory(b);
  }
  @Patch('menu/categories/:id') @Access('property') updateCategory(
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.updateCategory(id, b);
  }
  @Get('menu/items') items(@Query() q: Record<string, unknown>) {
    return this.service.menuItems(q);
  }
  @Get('menu/items/:id') item(@Param('id') id: string) {
    return this.service.menuItem(id);
  }
  @Post('menu/items') @Access('property') createItem(@Body() b: unknown) {
    return this.service.createMenuItem(b);
  }
  @Patch('menu/items/:id') @Access('property') updateItem(
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.updateMenuItem(id, b);
  }
  @Put('menu/items/:id/ingredients') @Access('property') replaceIngredients(
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.replaceIngredients(id, b);
  }
}
@Controller('food-service')
@Access('desk')
@RequiresBusinessCapability('food.orders')
export class FoodOrdersController {
  constructor(@Inject(RestaurantService) private readonly service: RestaurantService) {}
  @Get('orders') orders(@Query() q: Record<string, unknown>) {
    return this.service.orders(q);
  }
  @Post('orders') create(@Body() b: unknown) {
    return this.service.createOrder(b);
  }
  @Patch('orders/:id') update(@Param('id') id: string, @Body() b: unknown) {
    return this.service.updateOrder(id, b);
  }
  @Post('orders/:id/status') status(@Param('id') id: string, @Body() b: unknown) {
    return this.service.orderStatus(id, b);
  }
  @Post('tables/:id/cleaning') cleaning(@Param('id') id: string, @Body() b: unknown) {
    return this.service.tableCleaning(id, b);
  }
  @Get('report') report(@Query() q: Record<string, unknown>) {
    return this.service.report(q);
  }
}
@Controller('food-service')
@Access('desk')
@RequiresBusinessCapability('food.staff')
export class FoodStaffController {
  constructor(@Inject(RestaurantService) private readonly service: RestaurantService) {}
  @Get('employees') employees(@Query() q: Record<string, unknown>) {
    return this.service.employees(q);
  }
  @Post('employees') @Access('staff') createEmployee(@Body() b: unknown) {
    return this.service.createEmployee(b);
  }
  @Patch('employees/:id') @Access('staff') updateEmployee(
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.updateEmployee(id, b);
  }
  @Get('payroll') @Access('staff') payroll(@Query() q: Record<string, unknown>) {
    return this.service.payroll(q);
  }
  @Put('employees/:id/pay-settings') @Access('staff') paySettings(
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.setPaySettings(id, b);
  }
  @Post('employees/:id/pay-adjustments') @Access('staff') payAdjustment(
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.addPayAdjustment(id, b);
  }
}
@Module({
  controllers: [
    FoodCatalogController,
    FoodReservationsController,
    FoodMenuController,
    FoodOrdersController,
    FoodStaffController,
  ],
  providers: [PrismaService, FoodService, RestaurantService],
  exports: [FoodService, RestaurantService],
})
export class FoodModule {}
