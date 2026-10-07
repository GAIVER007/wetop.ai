import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { SitesRuntimeController } from './sites-runtime.controller';
import { PrismaSitesRuntimeRepository, SITES_RUNTIME_REPOSITORY } from './sites-runtime.repository';
import { SitesRuntimeService } from './sites-runtime.service';
import { SITE_ASSET_STORAGE, siteAssetStorageFromEnv } from '../marketing-site/asset-storage';

@Module({
  controllers: [SitesRuntimeController],
  providers: [
    PrismaService,
    { provide: SITES_RUNTIME_REPOSITORY, useClass: PrismaSitesRuntimeRepository },
    SitesRuntimeService,
    { provide: SITE_ASSET_STORAGE, useFactory: () => siteAssetStorageFromEnv() },
  ],
})
export class SitesRuntimeModule {}
