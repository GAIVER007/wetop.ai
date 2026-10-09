import { InventoryEditor, InventoryEditorController } from './inventory-editor';
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module';
import { PrismaService } from '../database/prisma.provider';
import { InventoryController } from './inventory.controller';
import { INVENTORY_REPOSITORY, PrismaInventoryRepository } from './inventory.repository';
import { InventoryService } from './inventory.service';
import { RatesModule } from '../rates/rates.module';
import { SITE_ASSET_STORAGE, siteAssetStorageFromEnv } from '../marketing-site/asset-storage';
import {
  CategoryPhotos,
  CategoryPhotosController,
  CategoryPhotosReadController,
} from './category-photos';

@Module({
  imports: [ChannelsModule, RatesModule],
  controllers: [
    InventoryController,
    InventoryEditorController,
    CategoryPhotosReadController,
    CategoryPhotosController,
  ],
  providers: [
    PrismaService,
    InventoryService,
    InventoryEditor,
    CategoryPhotos,
    { provide: SITE_ASSET_STORAGE, useFactory: () => siteAssetStorageFromEnv() },
    { provide: INVENTORY_REPOSITORY, useClass: PrismaInventoryRepository },
  ],
})
export class InventoryModule {}
