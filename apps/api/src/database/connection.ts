import 'reflect-metadata';
import { Controller, Get, Header, Inject, Injectable, Module } from '@nestjs/common';
import type { DataConnection } from '@pms/shared';
import { LUXX_APARTS_PROPERTY } from '@pms/imports';
import { PrismaService } from './prisma.provider';

function databaseProvider(): DataConnection['database']['provider'] {
  try {
    const { hostname } = new URL(process.env.DATABASE_URL ?? '');
    return ['supabase.com', 'supabase.co', 'supabase.net'].some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    )
      ? 'supabase'
      : 'postgresql';
  } catch {
    return 'unknown';
  }
}

@Injectable()
export class DataConnectionService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async status(): Promise<DataConnection> {
    const result: DataConnection = {
      source: 'database',
      state: 'DATABASE_UNAVAILABLE',
      message: 'База данных недоступна. Проверьте подключение backend к базе.',
      checkedAt: new Date().toISOString(),
      database: { connected: false, provider: databaseProvider() },
      property: null,
      counts: null,
    };
    try {
      // Approved single-property MVP selection, identical to the inventory and hotel APIs.
      const property = await this.prisma.db.property.findFirst({
        where: { name: LUXX_APARTS_PROPERTY.name },
        select: {
          id: true,
          name: true,
          timezone: true,
          currency: true,
          _count: {
            select: {
              accommodationTypes: true,
              reservations: true,
              ratePlans: true,
              services: true,
              trackedSites: true,
            },
          },
        },
      });
      if (!property)
        return {
          ...result,
          state: 'PROPERTY_MISSING',
          message: 'База подключена, но гостиница проекта не найдена.',
          database: { ...result.database, connected: true },
        };
      const units = await this.prisma.db.inventoryUnit.count({
        where: { accommodationType: { propertyId: property.id } },
      });
      return {
        ...result,
        state: 'READY',
        message: 'Данные проекта подключены',
        database: { ...result.database, connected: true },
        property: { name: property.name, timezone: property.timezone, currency: property.currency },
        counts: {
          units,
          categories: property._count.accommodationTypes,
          reservations: property._count.reservations,
          ratePlans: property._count.ratePlans,
          services: property._count.services,
          sites: property._count.trackedSites,
        },
      };
    } catch {
      // Diagnostic reads never record incidents, call providers, or expose a driver error/URL.
      return result;
    }
  }
}

@Controller('system')
class DataConnectionController {
  constructor(@Inject(DataConnectionService) private readonly service: DataConnectionService) {}
  @Get('connection')
  @Header('Cache-Control', 'no-store')
  status() {
    return this.service.status();
  }
}

@Module({
  controllers: [DataConnectionController],
  providers: [PrismaService, DataConnectionService],
})
export class DataConnectionModule {}
