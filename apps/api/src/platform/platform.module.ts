import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { EXTENSIONS_REPOSITORY, PrismaExtensionsRepository } from './extensions.repository';
import { ExtensionsService } from './extensions.service';
import { PlatformController } from './platform.controller';

/** Раздел «Платформа» и расширения организаций (DATA_MODEL §16, ADR-083) */
@Module({
  controllers: [PlatformController],
  providers: [
    PrismaService,
    { provide: EXTENSIONS_REPOSITORY, useClass: PrismaExtensionsRepository },
    ExtensionsService,
  ],
  exports: [ExtensionsService],
})
export class PlatformModule {}
