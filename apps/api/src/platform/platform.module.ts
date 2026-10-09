import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { EXTENSIONS_REPOSITORY, PrismaExtensionsRepository } from './extensions.repository';
import { ExtensionsService } from './extensions.service';
import { PlatformController } from './platform.controller';
import { PrismaSupportAudit, SUPPORT_AUDIT } from './support.audit';
import { EnvSupportConnection, SUPPORT_CONNECTION } from './support.connection';
import { SupportController } from './support.controller';
import { SupportKnowledgeService } from './support-kb.service';
import { SupportService } from './support.service';
import { SiteBuilderLicenses } from './site-builder-licenses';
import { mail } from '@pms/integrations';
import { DashboardModule } from '../dashboard/dashboard.module';
import { APP_URL, MAILER, PasswordResetService, type Mailer } from '../auth/password-reset.service';
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
    // письмо новому владельцу: тот же отправитель и та же ссылка, что у входа (AuthModule импортирует этот модуль,
    // поэтому службу сброса пароля берём здесь отдельным экземпляром, а не импортом модуля)
    PasswordResetService,
    {
      provide: MAILER,
      useFactory: (): Mailer | null => {
        const config = mail.mailConfigFromEnv(process.env);
        return config ? new mail.ResendMailSender({ config }) : null;
      },
    },
    { provide: APP_URL, useFactory: (): string => process.env.PUBLIC_APP_URL?.trim() || 'https://app.wetop.ai' },
  ],
  exports: [ExtensionsService],
})
export class PlatformModule {}
