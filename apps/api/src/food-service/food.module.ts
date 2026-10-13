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
import { SITE_ASSET_LIMITS } from '@pms/domain';
import { SITE_ASSET_STORAGE, siteAssetStorageFromEnv } from '../marketing-site/asset-storage';
import { MenuPhotoService } from './menu-photos';
import { OrderRatingLinkController, OrderRatingLinkService } from './order-rating-link';
import { Access } from '../auth/access.decorator';
import { RequiresBusinessCapability } from '../auth/capability.decorator';
import { PrismaService } from '../database/prisma.provider';
import { FoodService } from './food.service';
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
  @Patch('customers/:id') updateCustomer(@Param('id') id: string, @Body() b: unknown) {
    return this.service.updateCustomer(id, b);
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
  constructor(
    @Inject(RestaurantService) private readonly service: RestaurantService,
    @Inject(MenuPhotoService) private readonly photos: MenuPhotoService,
  ) {}
  // Фото блюда (DATA_MODEL §37): одно на блюдо, правка меню под `property`
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
  @Delete('menu/items/:id/photo') @Access('property') removePhoto(@Param('id') id: string) {
    return this.photos.remove(id);
  }
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
  @Post('payments/:id/void') @Access('refunds') @HttpCode(200) voidPayment(
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.voidPayment(id, b);
  }
  @Get('cash') cash() {
    return this.service.cash();
  }
  @Post('cash/operations') cashOperation(@Body() b: unknown) {
    return this.service.cashOperation(b);
  }
  @Post('cash/operations/:id/void') @Access('refunds') @HttpCode(200) voidCashOperation(
    @Param('id') id: string,
  ) {
    return this.service.voidCashOperation(id);
  }
  @Post('cash/reconciliations') cashReconciliation(@Body() b: unknown) {
    return this.service.cashReconciliation(b);
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
  @Post('employees/:id/payouts') @Access('staff') payout(@Param('id') id: string, @Body() b: unknown) {
    return this.service.payout(id, b);
  }
  @Post('employees/:id/pay-adjustments') @Access('staff') payAdjustment(
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.addPayAdjustment(id, b);
  }
}
/** Склад кухни FS2 (DATA_MODEL §34, ADR-KITCHEN-FS): справочник `property`, приход и списания `desk` */
@Controller('food-service')
@Access('desk')
@RequiresBusinessCapability('food.stock')
export class FoodStockController {
  constructor(@Inject(StockService) private readonly service: StockService) {}
  @Get('stock/products') products() {
    return this.service.products();
  }
  @Post('stock/products') @Access('property') createProduct(@Body() b: unknown) {
    return this.service.createProduct(b);
  }
  @Patch('stock/products/:id') @Access('property') updateProduct(
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.updateProduct(id, b);
  }
  @Get('stock/lots') lots(@Query() q: Record<string, unknown>) {
    return this.service.lots(q);
  }
  @Get('stock/movements') movements(@Query() q: Record<string, unknown>) {
    return this.service.movements(q);
  }
  @Post('stock/receipts') receipt(@Body() b: unknown) {
    return this.service.receipt(b);
  }
  @Post('stock/lots/:id/reverse') @Access('property') reverse(@Param('id') id: string) {
    return this.service.reverseLot(id);
  }
  @Post('stock/write-offs') writeOff(@Body() b: unknown) {
    return this.service.writeOff(b);
  }
  @Post('stock/inventory') inventory(@Body() b: unknown) {
    return this.service.inventory(b);
  }
}
@Module({
  controllers: [
    FoodCatalogController,
    FoodReservationsController,
    FoodMenuController,
    FoodOrdersController,
    FoodStaffController,
    FoodStockController,
    OrderRatingLinkController,
  ],
  providers: [
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
