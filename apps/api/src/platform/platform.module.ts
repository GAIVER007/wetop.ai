import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { mail } from '@pms/integrations';
import { PrismaService } from '../database/prisma.provider';
import { EXTENSIONS_REPOSITORY, PrismaExtensionsRepository } from './extensions.repository';
import { ExtensionsService } from './extensions.service';
import { OrganizationCreation, PLATFORM_APP_URL, PLATFORM_MAILER } from './organization-creation';
import { appUrlFromEnv, type Mailer } from '../auth/password-reset.service';
import { PlatformController } from './platform.controller';
import { CabinetController } from './cabinet.controller';
import { CABINET_REPOSITORY, PrismaCabinetRepository } from './cabinet.repository';
import { MoneyController } from './money.controller';
import { OwnerBusinessesController } from './owner-businesses.controller';
import { EXCHANGE_FETCH, ExchangeRatesService, fetchNbk } from './exchange-rates';
import { GROWTH_REPOSITORY, GrowthController, PrismaGrowthRepository } from './growth.controller';
import { CLIENT_CARD_REPOSITORY, ClientCardController, PrismaClientCardRepository } from './client-card.controller';
import { MONEY_REPOSITORY, PrismaMoneyRepository } from './money.repository';
import { PrismaSupportAudit, SUPPORT_AUDIT } from './support.audit';
import { EnvSupportConnection, SUPPORT_CONNECTION } from './support.connection';
import { SupportController } from './support.controller';
import { SupportKnowledgeService } from './support-kb.service';
import { SupportService } from './support.service';
import { SiteBuilderLicenses } from './site-builder-licenses';
import {
  PrismaSubscriptionNightlyRepository,
  SUBSCRIPTION_NIGHTLY_REPOSITORY,
  SubscriptionNightlyService,
} from './subscription-nightly';

/** Раздел «Платформа»: организации и их расширения, техподдержка — панель ИИ-помощника (DATA_MODEL §16, ADR-083) */
@Module({
  controllers: [PlatformController, SupportController, CabinetController, MoneyController, GrowthController, ClientCardController, OwnerBusinessesController],
  providers: [
    PrismaService,
    // кабинет компании WETOP (владелец 28.10.2026)
    { provide: CABINET_REPOSITORY, useClass: PrismaCabinetRepository },
    // деньги компании WETOP (DATA_MODEL §63)
    { provide: MONEY_REPOSITORY, useClass: PrismaMoneyRepository },
    { provide: GROWTH_REPOSITORY, useClass: PrismaGrowthRepository },
    { provide: CLIENT_CARD_REPOSITORY, useClass: PrismaClientCardRepository },
    { provide: EXTENSIONS_REPOSITORY, useClass: PrismaExtensionsRepository },
    ExtensionsService,
    { provide: SUPPORT_CONNECTION, useClass: EnvSupportConnection },
    { provide: SUPPORT_AUDIT, useClass: PrismaSupportAudit },
    SupportService,
    SupportKnowledgeService,
    SiteBuilderLicenses,
    // ночная проверка подписок (срез 4 кабинета руководителя, 29.10.2026)
    { provide: SUBSCRIPTION_NIGHTLY_REPOSITORY, useClass: PrismaSubscriptionNightlyRepository },
    SubscriptionNightlyService,
    // курсы Нацбанка РК по дням для «Все бизнесы» в валюте компании (владелец 01.11.2026, миграция 180)
    { provide: EXCHANGE_FETCH, useValue: fetchNbk },
    ExchangeRatesService,
    // создание организации (ORG2): письмо владельцу уходит тем же отправителем и на тот же адрес стойки, что сброс пароля
    OrganizationCreation,
    {
      provide: PLATFORM_MAILER,
      useFactory: (): Mailer | null => {
        const config = mail.mailConfigFromEnv(process.env);
        return config ? new mail.ResendMailSender({ config }) : null;
      },
    },
    {
      provide: PLATFORM_APP_URL,
      useFactory: (): string => appUrlFromEnv(),
    },
  ],
  exports: [ExtensionsService],
})
export class PlatformModule {}
