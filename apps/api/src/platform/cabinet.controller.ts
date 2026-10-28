import 'reflect-metadata';
import { Controller, Get, Header, Inject, UseInterceptors } from '@nestjs/common';
import { ServiceDatabaseInterceptor } from '../database/service-database.interceptor';
import { currentOrganizationId } from '../auth/request-context';
import { Access } from '../auth/access.decorator';
import { requirePlatformAdmin } from './admin';
import { buildCabinet } from './cabinet';
import { CABINET_REPOSITORY, type CabinetRepository } from './cabinet.repository';

/**
 * Кабинет компании WETOP (владелец 28.10.2026, вариант «Г»): главная главного администратора. Только вошедшему с
 * отметкой `platform_admins`, как весь раздел «Платформа» (ADR-083). Своя организация администратора не клиент.
 */
@Access('platform')
@UseInterceptors(ServiceDatabaseInterceptor)
@Controller('platform')
export class CabinetController {
  constructor(@Inject(CABINET_REPOSITORY) private readonly repo: CabinetRepository) {}

  @Get('cabinet')
  @Header('Cache-Control', 'no-store')
  async cabinet() {
    requirePlatformAdmin();
    const now = new Date();
    const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return buildCabinet(await this.repo.source({ since30d, ownOrganizationId: currentOrganizationId() }), now);
  }
}
