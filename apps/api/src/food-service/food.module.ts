import { BeautyAccess } from '../beauty/access.decorator';
import 'reflect-metadata';
import {
  Body,
  HttpCode,
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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RESTRICTED_CATALOG_WRITE_MESSAGE, SITE_ASSET_LIMITS } from '@pms/domain';
import { SITE_ASSET_STORAGE, siteAssetStorageFromEnv } from '../marketing-site/asset-storage';
import { MenuPhotoService } from './menu-photos';
import { OrderRatingLinkController, OrderRatingLinkService } from './order-rating-link';
import { Access } from '../auth/access.decorator';
import { OrganizationLevel } from '../auth/organization-level.decorator';
import { RequiresBusinessCapability } from '../auth/capability.decorator';
import { PrismaService } from '../database/prisma.provider';
import { FoodService } from './food.service';
import { RestaurantOpeningController, RestaurantOpeningService } from './opening';
import { RestaurantService } from './restaurant.service';
import { StockService } from './stock.service';
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
  // Правила брони столов (§43, ADR-177): смотрят все роли стойки, меняет право «объект»
  @Get('booking-rules') bookingSettings() {
    return this.service.bookingSettings();
  }
  @Put('booking-rules') @Access('property') setBookingRules(@Body() b: unknown) {
    return this.service.setBookingRules(b);
  }
  @Post('closed-days') @Access('property') addClosedDay(@Body() b: unknown) {
    return this.service.addClosedDay(b);
  }
  @Delete('closed-days/:id') @Access('property') removeClosedDay(@Param('id') id: string) {
    return this.service.removeClosedDay(id);
  }
  // Схема зала (§42, ADR-174): расстановка зоны целиком
  @Put('areas/:id/layout') @Access('property') layout(@Param('id') id: string, @Body() b: unknown) {
    return this.service.setLayout(id, b);
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
  @Get('occupancy-sessions') occupancySessions(@Query() q: Record<string,unknown>) { return this.service.occupancySessions(q); }
  @Post('occupancy-sessions') seat(@Headers('idempotency-key') key: unknown,@Body() b: unknown) { return this.service.occupancy(key,b,'SEAT'); }
  @Post('occupancy-sessions/:id/closure') release(@Param('id') id: string,@Headers('idempotency-key') key: unknown,@Body() b: unknown) { return this.service.occupancy(key,b,'RELEASE',id); }
  @Post('occupancy-sessions/:id/relocations') relocate(@Param('id') id: string,@Headers('idempotency-key') key: unknown,@Body() b: unknown) { return this.service.occupancy(key,b,'MOVE',id); }
  @Get('customers') customers(@Query() q: Record<string, unknown>) {
    return this.service.customers(q);
  }
  @Patch('customers/:id') updateCustomer(@Param('id') id: string, @Body() b: unknown) {
    return this.service.updateCustomer(id, b);
  }
  // официант видит и создаёт свои брони (§33.6): право `orders`, сервис сужает до своего сотрудника
  @Get('reservations') @Access('orders') list(@Query() q: Record<string, unknown>) {
    return this.service.reservations(q);
  }
  @Post('reservations') @Access('orders') create(@Headers('idempotency-key') key: unknown, @Body() b: unknown) {
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
  constructor(
    @Inject(RestaurantService) private readonly service: RestaurantService,
    @Inject(MenuPhotoService) private readonly photos: MenuPhotoService,
  ) {}
  // Фото блюда (DATA_MODEL §37): одно на блюдо, правка меню под `property`
  @OrganizationLevel(RESTRICTED_CATALOG_WRITE_MESSAGE)
  @Post('menu/items/:id/photo')
  @Access('property')
  @HttpCode(201)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: SITE_ASSET_LIMITS.maxUploadBytes, files: 1, fields: 2, parts: 4 },
    }),
  )
  uploadPhoto(@Param('id') id: string, @UploadedFile() file: { buffer?: Buffer } | undefined) {
    return this.photos.upload(id, file);
  }
  @OrganizationLevel(RESTRICTED_CATALOG_WRITE_MESSAGE)
  @Delete('menu/items/:id/photo') @Access('property') removePhoto(@Param('id') id: string) {
    return this.photos.remove(id);
  }
  @Get('menu/categories') @Access('orders') categories(@Query() q: Record<string, unknown>) {
    return this.service.categories(q);
  }
  @OrganizationLevel(RESTRICTED_CATALOG_WRITE_MESSAGE)
  @Post('menu/categories') @Access('property') createCategory(@Body() b: unknown) {
    return this.service.createCategory(b);
  }
  @OrganizationLevel(RESTRICTED_CATALOG_WRITE_MESSAGE)
  @Patch('menu/categories/:id') @Access('property') updateCategory(
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.updateCategory(id, b);
  }
  @Get('menu/items') @Access('orders') items(@Query() q: Record<string, unknown>) {
    return this.service.menuItems(q);
  }
  @Get('menu/items/:id') item(@Param('id') id: string) {
    return this.service.menuItem(id);
  }
  @OrganizationLevel(RESTRICTED_CATALOG_WRITE_MESSAGE)
  @Post('menu/items') @Access('property') createItem(@Body() b: unknown) {
    return this.service.createMenuItem(b);
  }
  @OrganizationLevel(RESTRICTED_CATALOG_WRITE_MESSAGE)
  @Patch('menu/items/:id') @Access('property') updateItem(
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.updateMenuItem(id, b);
  }
  @OrganizationLevel(RESTRICTED_CATALOG_WRITE_MESSAGE)
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
  // Официант с телефона (§33.6): столы зала, свои заказы, заказ на себя, дозаказ, «Подано» по позиции
  @Get('waiter/tables') @Access('orders') waiterTables() {
    return this.service.waiterTables();
  }
  @Get('orders') @Access('orders') orders(@Query() q: Record<string, unknown>) {
    return this.service.orders(q);
  }
  @Post('orders') @Access('orders') create(@Body() b: unknown) {
    return this.service.createOrder(b);
  }
  @Patch('orders/:id') @Access('orders') update(@Param('id') id: string, @Body() b: unknown) {
    return this.service.updateOrder(id, b);
  }
  @Post('orders/:id/status') status(@Param('id') id: string, @Body() b: unknown) {
    return this.service.orderStatus(id, b);
  }
  // Кухня и бар двигают свою позицию (§33.6, миграция 142)
  @Post('orders/:id/items/:itemId/status') @Access('orders') @HttpCode(200) itemStatus(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() b: unknown,
  ) {
    return this.service.orderItemStatus(id, itemId, b);
  }
  // Оплата и касса филиала (DATA_MODEL §35, ADR-165): смотрит и проводит смена, аннулирует `refunds`
  @Post('orders/:id/rating') rate(@Param('id') id: string, @Body() b: unknown) {
    return this.service.rateOrder(id, b);
  }
  @Post('orders/:id/rating-link') @HttpCode(200) ratingLink(@Param('id') id: string) {
    return this.service.ratingLink(id);
  }
  @Post('orders/:id/payments') pay(@Param('id') id: string, @Body() b: unknown) {
    return this.service.payOrder(id, b);
  }
  /** Возврат по закрытому заказу (§56): право возвратов */
  @Post('orders/:id/refunds') @Access('refunds') refundOrder(@Param('id') id: string, @Body() b: unknown) {
    return this.service.refundOrder(id, b);
  }
  @Post('payments/:id/void') @Access('refunds') @HttpCode(200) voidPayment(
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.voidPayment(id, b);
  }
  @Post('tables/:id/cleaning') cleaning(@Param('id') id: string, @Body() b: unknown) {
    return this.service.tableCleaning(id, b);
  }
  @Get('report') report(@Query() q: Record<string, unknown>) {
    return this.service.report(q);
  }
  @Get('period-report') @Access('reports') periodReport(@Query() q: Record<string, unknown>) {
    return this.service.periodReport(q);
  }
}
/** Зарплата (§33.4, §19.2): общая у ресторана и салона (ADR-SALON-PAYROLL-20261016); адреса прежние */
@Controller('food-service')
@Access('desk')
@RequiresBusinessCapability('branch.payroll')
export class BranchPayrollController {
  constructor(@Inject(RestaurantService) private readonly service: RestaurantService) {}
  @BeautyAccess('payroll','view')
  @Get('payroll') @Access('staff') payroll(@Query() q: Record<string, unknown>) {
    return this.service.payroll(q);
  }
  @BeautyAccess('payroll','update')
  @Put('employees/:id/pay-settings') @Access('staff') paySettings(
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.setPaySettings(id, b);
  }
  @BeautyAccess('payroll','create',{also:[{section:'finance',action:'create'}]})
  @Post('employees/:id/payouts') @Access('staff') payout(@Param('id') id: string, @Body() b: unknown) {
    return this.service.payout(id, b);
  }
  @BeautyAccess('payroll','update')
  @Post('employees/:id/pay-adjustments') @Access('staff') payAdjustment(
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.addPayAdjustment(id, b);
  }
}
/** Касса филиала (§35.2): общая у ресторана и салона (§48, ADR-178 этап 0); адреса прежние */
@Controller('food-service')
@Access('desk')
@RequiresBusinessCapability('branch.cash')
export class BranchCashController {
  constructor(@Inject(RestaurantService) private readonly service: RestaurantService) {}
  @BeautyAccess('finance','view')
  @Get('cash') cash(@Query() q: Record<string, unknown>) {
    return this.service.cash(q);
  }
  /** «Сколько принёс сотрудник» (docs/decisions/2026-10-20-personnel-revenue.md): оплачено минус возвраты */
  @BeautyAccess('finance','view')
  @Get('staff-revenue') @Access('reports') staffRevenue(@Query() q: Record<string, unknown>) {
    return this.service.staffRevenue(q);
  }
  @BeautyAccess('finance','create')
  @Post('cash/operations') cashOperation(@Body() b: unknown) {
    return this.service.cashOperation(b);
  }
  @BeautyAccess('finance','refund')
  @Post('cash/operations/:id/void') @Access('refunds') @HttpCode(200) voidCashOperation(
    @Param('id') id: string,
  ) {
    return this.service.voidCashOperation(id);
  }
  @BeautyAccess('finance','update')
  @Post('cash/reconciliations') cashReconciliation(@Body() b: unknown) {
    return this.service.cashReconciliation(b);
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
  // Назначение «специалист / другой сотрудник / оба» (решение владельца 20.10.2026): право «сотрудники» + руководитель
  @Patch('employees/:id/personnel-kind') @Access('staff') assignPersonnelKind(
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.assignPersonnelKind(id, b);
  }
  @Patch('employees/:id') @Access('staff') updateEmployee(
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.updateEmployee(id, b);
  }
  // График смен (Q-REST-11): смотрят все роли стойки, меняет право «сотрудники»
  @Get('shifts') shifts() {
    return this.service.shifts();
  }
  @Put('employees/:id/working-hours') @Access('staff') setShifts(@Param('id') id: string, @Body() b: unknown) {
    return this.service.setShifts(id, b);
  }
}
/** Склад кухни FS2 (DATA_MODEL §34, ADR-KITCHEN-FS): справочник `property`, приход и списания `desk` */
@Controller('food-service')
@Access('desk')
@RequiresBusinessCapability('branch.stock')
export class FoodStockController {
  constructor(@Inject(StockService) private readonly service: StockService) {}
  @BeautyAccess('stock', 'view')
  @Get('stock/products') products() {
    return this.service.products();
  }
  @BeautyAccess('stock', 'create')
  @Post('stock/products') @Access('property') createProduct(@Body() b: unknown) {
    return this.service.createProduct(b);
  }
  @BeautyAccess('stock', 'update')
  @Patch('stock/products/:id') @Access('property') updateProduct(
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.updateProduct(id, b);
  }
  @BeautyAccess('stock', 'view')
  @Get('stock/lots') lots(@Query() q: Record<string, unknown>) {
    return this.service.lots(q);
  }
  @BeautyAccess('stock', 'view')
  @Get('stock/movements') movements(@Query() q: Record<string, unknown>) {
    return this.service.movements(q);
  }
  @BeautyAccess('stock', 'create')
  @Post('stock/receipts') receipt(@Body() b: unknown) {
    return this.service.receipt(b);
  }
  @BeautyAccess('stock', 'delete')
  @Post('stock/lots/:id/reverse') @Access('property') reverse(@Param('id') id: string) {
    return this.service.reverseLot(id);
  }
  @BeautyAccess('stock', 'update')
  @Post('stock/write-offs') writeOff(@Body() b: unknown) {
    return this.service.writeOff(b);
  }
  @BeautyAccess('stock', 'update')
  @Post('stock/inventory') inventory(@Body() b: unknown) {
    return this.service.inventory(b);
  }
}
@Module({
  controllers: [
    RestaurantOpeningController,
    FoodCatalogController,
    FoodReservationsController,
    FoodMenuController,
    FoodOrdersController,
    BranchCashController,
    BranchPayrollController,
    FoodStaffController,
    FoodStockController,
    OrderRatingLinkController,
  ],
  providers: [
    RestaurantOpeningService,
    PrismaService,
    FoodService,
    RestaurantService,
    StockService,
    MenuPhotoService,
    OrderRatingLinkService,
    { provide: SITE_ASSET_STORAGE, useFactory: () => siteAssetStorageFromEnv() },
  ],
  exports: [FoodService, RestaurantService],
})
export class FoodModule {}
