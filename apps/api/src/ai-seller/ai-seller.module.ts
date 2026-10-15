import { VerticalToolsService } from './vertical-tools.service';
import { VerticalToolsController } from './vertical-tools.controller';
import { AgentTelegramService } from './agent-telegram.service';
import { AgentTelegramController } from './agent-telegram.controller';
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { PlatformModule } from '../platform/platform.module';
import { AiSellerController } from './ai-seller.controller';
import { AgentInstructionsService } from './agent-instructions.service';
import { AgentInstructionsController } from './agent-instructions.controller';
import { BusinessAgentsController } from './business-agents.controller';
import { BUSINESS_AGENTS, PrismaBusinessAgentsRepository } from './business-agents.repository';
import { BusinessAgentsService } from './business-agents.service';
import { EnvSellerConnection, SELLER_CONNECTION } from './seller.connection';
import {
  PrismaSellerAudit,
  PrismaSellerCatalogRepository,
  PrismaSellerFactsRepository,
  PrismaSellerOrgsRepository,
  PrismaSellerProfilesRepository,
  SELLER_AUDIT,
  SELLER_CATALOG,
  SELLER_FACTS,
  SELLER_ORGS,
  SELLER_PROFILES,
} from './seller.repository';
import { SellerCatalogService } from './seller-catalog.service';
import { SellerService } from './seller.service';
import { SellerSyncService } from './seller-sync.service';

/**
 * Раздел «ИИ-продавец» (ТЗ ред. 1 П5, П7, П8; ADR-079): профиль, прокси к продавцу, применение и сверка. Работает только
 * у организации с действующим расширением (ADR-083) — его состояние даёт `PlatformModule`.
 */
@Module({
  imports: [PlatformModule],
  controllers: [VerticalToolsController, AgentTelegramController, AiSellerController, BusinessAgentsController, AgentInstructionsController],
  providers: [
    PrismaService,
    VerticalToolsService,
    { provide: SELLER_CONNECTION, useClass: EnvSellerConnection },
    { provide: SELLER_PROFILES, useClass: PrismaSellerProfilesRepository },
    { provide: SELLER_FACTS, useClass: PrismaSellerFactsRepository },
    { provide: SELLER_AUDIT, useClass: PrismaSellerAudit },
    { provide: SELLER_ORGS, useClass: PrismaSellerOrgsRepository },
    { provide: SELLER_CATALOG, useClass: PrismaSellerCatalogRepository },
    SellerService,
    { provide: BUSINESS_AGENTS, useClass: PrismaBusinessAgentsRepository },
    BusinessAgentsService,
    AgentInstructionsService,
    AgentTelegramService,
    SellerCatalogService,
    SellerSyncService,
  ],
})
export class AiSellerModule {}
