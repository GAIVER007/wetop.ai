import 'reflect-metadata';
import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Access } from '../auth/access.decorator';
import { BeautyAccess } from '../beauty/access.decorator';
import { BarService } from './bar.service';
import { BarScanService } from './bar-scan.service';

@Access('desk')
@Controller('bar')
export class BarController {
  constructor(
    @Inject(BarService) private readonly service: BarService,
    @Inject(BarScanService) private readonly scan: BarScanService,
  ) {}
  @BeautyAccess('stock','view')
  @Get('categories') categories() { return this.service.categories(); }
  @Access('settings')
  @BeautyAccess('stock','create')
  @Post('categories') createCategory(@Body() body: unknown) { return this.service.createCategory(body); }
  @Access('settings')
  @BeautyAccess('stock','update')
  @Patch('categories/:id/active') setCategoryActive(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) { return this.service.setCategoryActive(id, body); }
  @BeautyAccess('stock','view')
  @Get('products') products() { return this.service.products(); }
  @Access('settings')
  @BeautyAccess('stock','create')
  @Post('products') createProduct(@Body() body: unknown) { return this.service.createProduct(body); }
  @Access('settings')
  @BeautyAccess('stock','update')
  @Patch('products/:id/active') setProductActive(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) { return this.service.setProductActive(id, body); }
  @Access('settings')
  @BeautyAccess('stock','update')
  @Patch('products/:id/price') setProductPrice(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) { return this.service.setProductPrice(id, body); }
  // правка карточки (ADR-157, макет владельца): название, категория, штрихкод, упаковка, наценка, минимум
  @Access('settings')
  @BeautyAccess('stock','update')
  @Patch('products/:id') updateProduct(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) { return this.service.updateProduct(id, body); }
  @BeautyAccess('stock','view')
  @Get('suppliers') suppliers() { return this.service.suppliers(); }
  @Access('settings')
  @BeautyAccess('stock','create')
  @Post('suppliers') createSupplier(@Body() body: unknown) { return this.service.createSupplier(body); }
  @Access('settings')
  @BeautyAccess('stock','update')
  @Patch('suppliers/:id/active') setSupplierActive(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) { return this.service.setSupplierActive(id, body); }
  @BeautyAccess('stock','view')
  @Get('receipts') receipts() { return this.service.receipts(); }
  @BeautyAccess('stock','view')
  @Get('stock') stock() { return this.service.stock(); }
  @BeautyAccess('stock','view')
  @Get('payment-methods') paymentMethods() { return this.service.paymentMethods(); }
  @BeautyAccess('stock','view')
  @Get('sales') sales() { return this.service.sales(); }
  @Get('folios') folios() { return this.service.folios(); }
  @BeautyAccess('stock','view')
  @Get('movements') movements() { return this.service.movements(); }
  @BeautyAccess('stock','view')
  @Get('report') report() { return this.service.report(); }
  @BeautyAccess('stock','create',{also:[{section:'finance',action:'create'}]})
  @Post('sales/retail') sellRetail(@Body() body: unknown) { return this.service.sellRetail(body); }
  @Post('sales/folio') sellToFolio(@Body() body: unknown) { return this.service.sellToFolio(body); }
  // сторно гасит кассовую операцию и начисление фолио, поэтому право как у аннулирований /finance (ADR-181)
  @Access('refunds')
  @BeautyAccess('finance','refund')
  @Post('sales/:id/reverse') reverseSale(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) { return this.service.reverseSale(id, body); }
  @BeautyAccess('stock','update')
  @Post('write-offs') writeOff(@Body() body: unknown) { return this.service.writeOff(body); }
  @BeautyAccess('stock','update')
  @Post('inventory-counts') inventoryCount(@Body() body: unknown) { return this.service.inventoryCount(body); }
  @BeautyAccess('stock','create')
  @Post('receipts') createReceipt(@Body() body: unknown) { return this.service.createReceipt(body); }
  // ИИ-скан накладной (ADR-157): фото внутрь, строки формы наружу; ничего не создаёт и не проводит
  @BeautyAccess('stock','create')
  @Post('receipts/scan') scanReceipt(@Body() body: unknown) { return this.scan.scanReceipt(body); }
  @BeautyAccess('stock','update')
  @Post('receipts/:id/post') postReceipt(@Param('id', ParseUUIDPipe) id: string) { return this.service.postReceipt(id); }
  @BeautyAccess('finance','create')
  @Post('receipts/:id/payments') payReceipt(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) { return this.service.payReceipt(id, body); }
}
