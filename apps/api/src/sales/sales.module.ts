import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { PrismaSalesRepository, SALES_REPOSITORY } from './sales.repository';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  controllers: [SalesController],
  providers: [PrismaService, { provide: SALES_REPOSITORY, useClass: PrismaSalesRepository }, SalesService],
})
export class SalesModule {}
