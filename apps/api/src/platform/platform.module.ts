import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { mail } from '@pms/integrations';
import { PrismaService } from '../database/prisma.provider';
import { EXTENSIONS_REPOSITORY, PrismaExtensionsRepository } from './extensions.repository';
import { ExtensionsService } from './extensions.service';
import { OrganizationCreation, PLATFORM_APP_URL, PLATFORM_MAILER } from './organization-creation';
import type { Mailer } from '../auth/password-reset.service';
import { PlatformController } from './platform.controller';
import { PrismaSupportAudit, SUPPORT_AUDIT } from './support.audit';
import { EnvSupportConnection, SUPPORT_CONNECTION } from './support.connection';
import { SupportController } from './support.controller';
import { SupportKnowledgeService } from './support-kb.service';
import { SupportService } from './support.service';
import { SiteBuilderLicenses } from './site-builder-licenses';
import { DashboardModule } from '../dashboard/dashboard.module';
import { OrganizationsRepository } from './organizations.repository';
import { OrganizationsService } from './organizations.service';

/** Раздел «Платформа»: организации и их расширения, техподдержка — панель ИИ-помощника (DATA_MODEL §16, ADR-083) */
@Module({
  // отчёт объекта для сквозного обзора берётся у самого дашборда: одни формулы на объект и на платформу
  imports: [DashboardModule],
  controllers: [PlatformController, SupportController],
  providers: [
    PrismaService,
    { provide: EXTENSIONS_REPOSITORY, useClass: PrismaExtensionsRepository },
    ExtensionsService,
    { provide: SUPPORT_CONNECTION, useClass: EnvSupportConnection },
    { provide: SUPPORT_AUDIT, useClass: PrismaSupportAudit },
    SupportService,
    SupportKnowledgeService,
    SiteBuilderLicenses,
    OrganizationsRepository,
    OrganizationsService,
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
      useFactory: (): string => process.env.PUBLIC_APP_URL?.trim() || 'https://app.wetop.ai',
    },
  ],
  exports: [ExtensionsService],
})
export class PlatformModule {}
