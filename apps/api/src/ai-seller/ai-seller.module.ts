import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { PlatformModule } from '../platform/platform.module';
import { AiSellerController } from './ai-seller.controller';
import { EnvSellerConnection, SELLER_CONNECTION } from './seller.connection';
import {
  PrismaSellerAudit,
  PrismaSellerFactsRepository,
  PrismaSellerOrgsRepository,
  PrismaSellerProfilesRepository,
  SELLER_AUDIT,
  SELLER_FACTS,
  SELLER_ORGS,
  SELLER_PROFILES,
} from './seller.repository';
import { SellerService } from './seller.service';
import { SellerSyncService } from './seller-sync.service';

/**
 * Раздел «ИИ-продавец» (ТЗ ред. 1 П5, П7, П8; ADR-079): профиль, прокси к продавцу, применение и сверка. Работает только
 * у организации с действующим расширением (ADR-083) — его состояние даёт `PlatformModule`.
 */
@Module({
  imports: [PlatformModule],
  controllers: [AiSellerController],
  providers: [
    PrismaService,
    { provide: SELLER_CONNECTION, useClass: EnvSellerConnection },
    { provide: SELLER_PROFILES, useClass: PrismaSellerProfilesRepository },
    { provide: SELLER_FACTS, useClass: PrismaSellerFactsRepository },
    { provide: SELLER_AUDIT, useClass: PrismaSellerAudit },
    { provide: SELLER_ORGS, useClass: PrismaSellerOrgsRepository },
    SellerService,
    SellerSyncService,
  ],
})
export class AiSellerModule {}
