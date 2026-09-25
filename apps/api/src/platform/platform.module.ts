import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { EXTENSIONS_REPOSITORY, PrismaExtensionsRepository } from './extensions.repository';
import { ExtensionsService } from './extensions.service';
import { PlatformController } from './platform.controller';
import { PrismaSupportAudit, SUPPORT_AUDIT } from './support.audit';
import { EnvSupportConnection, SUPPORT_CONNECTION } from './support.connection';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

/** Раздел «Платформа»: организации и их расширения, техподдержка — панель ИИ-помощника (DATA_MODEL §16, ADR-083) */
@Module({
  controllers: [PlatformController, SupportController],
  providers: [
    PrismaService,
    { provide: EXTENSIONS_REPOSITORY, useClass: PrismaExtensionsRepository },
    ExtensionsService,
    { provide: SUPPORT_CONNECTION, useClass: EnvSupportConnection },
    { provide: SUPPORT_AUDIT, useClass: PrismaSupportAudit },
    SupportService,
  ],
  exports: [ExtensionsService],
})
export class PlatformModule {}
