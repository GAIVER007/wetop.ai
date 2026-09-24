import { InventoryEditor, InventoryEditorController } from './inventory-editor';
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { InventoryController } from './inventory.controller';
import { INVENTORY_REPOSITORY, PrismaInventoryRepository } from './inventory.repository';
import { InventoryService } from './inventory.service';

@Module({
  controllers: [InventoryController, InventoryEditorController],
  providers: [
    PrismaService,
    InventoryService,
    InventoryEditor,
    { provide: INVENTORY_REPOSITORY, useClass: PrismaInventoryRepository },
  ],
})
export class InventoryModule {}
