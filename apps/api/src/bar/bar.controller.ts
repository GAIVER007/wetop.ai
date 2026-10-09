import 'reflect-metadata';
import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Access } from '../auth/access.decorator';
import { BarService } from './bar.service';
import { BarScanService } from './bar-scan.service';

@Access('desk')
@Controller('bar')
export class BarController {
  constructor(
    @Inject(BarService) private readonly service: BarService,
    @Inject(BarScanService) private readonly scan: BarScanService,
  ) {}
  @Get('categories') categories() { return this.service.categories(); }
  @Access('settings')
  @Post('categories') createCategory(@Body() body: unknown) { return this.service.createCategory(body); }
  @Access('settings')
  @Patch('categories/:id/active') setCategoryActive(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) { return this.service.setCategoryActive(id, body); }
  @Get('products') products() { return this.service.products(); }
  @Access('settings')
  @Post('products') createProduct(@Body() body: unknown) { return this.service.createProduct(body); }
  @Access('settings')
  @Patch('products/:id/active') setProductActive(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) { return this.service.setProductActive(id, body); }
  @Access('settings')
  @Patch('products/:id/price') setProductPrice(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) { return this.service.setProductPrice(id, body); }
  @Get('suppliers') suppliers() { return this.service.suppliers(); }
  @Access('settings')
  @Post('suppliers') createSupplier(@Body() body: unknown) { return this.service.createSupplier(body); }
  @Access('settings')
  @Patch('suppliers/:id/active') setSupplierActive(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) { return this.service.setSupplierActive(id, body); }
  @Get('receipts') receipts() { return this.service.receipts(); }
  @Get('stock') stock() { return this.service.stock(); }
  @Get('sales') sales() { return this.service.sales(); }
  @Get('folios') folios() { return this.service.folios(); }
  @Get('movements') movements() { return this.service.movements(); }
  @Get('report') report() { return this.service.report(); }
  @Post('sales/retail') sellRetail(@Body() body: unknown) { return this.service.sellRetail(body); }
  @Post('sales/folio') sellToFolio(@Body() body: unknown) { return this.service.sellToFolio(body); }
  @Post('sales/:id/reverse') reverseSale(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) { return this.service.reverseSale(id, body); }
  @Post('write-offs') writeOff(@Body() body: unknown) { return this.service.writeOff(body); }
  @Post('inventory-counts') inventoryCount(@Body() body: unknown) { return this.service.inventoryCount(body); }
  @Post('receipts') createReceipt(@Body() body: unknown) { return this.service.createReceipt(body); }
  // ИИ-скан накладной (ADR-152): фото внутрь, строки формы наружу; ничего не создаёт и не проводит
  @Post('receipts/scan') scanReceipt(@Body() body: unknown) { return this.scan.scanReceipt(body); }
  @Post('receipts/:id/post') postReceipt(@Param('id', ParseUUIDPipe) id: string) { return this.service.postReceipt(id); }
  @Post('receipts/:id/payments') payReceipt(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) { return this.service.payReceipt(id, body); }
}
