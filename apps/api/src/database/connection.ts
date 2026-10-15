import 'reflect-metadata';
import { Controller, Get, Header, HttpException, Inject, Injectable, Module } from '@nestjs/common';
import { databaseSchemaName } from '@pms/database';
import type { DataConnection } from '@pms/shared';
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
import { PrismaService } from './prisma.provider';
import { propertyRef } from './property-ref';
import { Access } from '../auth/access.decorator';
import { actsForOrganization } from '../auth/request-context';

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

  /**
   * Вошедший человек (и публичный путь организации): объект по области запроса через `propertyRef`; чужая организация,
   * чужая вертикаль и филиал вне назначений дают 403 или 404. Служебный ходок (сторож, скрипты, прогон e2e) человека
   * за собой не имеет и берёт объект установки по имени, как раньше; `null`: объекта в базе ещё нет.
   */
  private async propertyId(): Promise<string | null> {
    if (actsForOrganization())
      return (await propertyRef(this.prisma.db, LUXX_APARTS_PROPERTY.name)).id;
    const found = await this.prisma.db.property.findFirst({
      where: { name: LUXX_APARTS_PROPERTY.name },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return found?.id ?? null;
  }

  async status(): Promise<DataConnection> {
    const result: DataConnection = {
      source: 'database',
      state: 'DATABASE_UNAVAILABLE',
      message: 'База данных недоступна. Проверьте подключение backend к базе.',
      checkedAt: new Date().toISOString(),
      // схема не секрет: по ней прогон e2e убеждается, что пишет в pms_test, а не в рабочие данные (ADR-042)
      database: { connected: false, provider: databaseProvider(), schema: databaseSchemaName() },
      property: null,
      counts: null,
    };
    try {
      // Объект берётся через область запроса, как во всех остальных модулях объекта (CORE-SECURITY-FIX-01, A2):
      // вошедший видит гостиницу своего выбранного места. Раньше объект искался по имени `Luxx Aparts`, и ограниченный
      // менеджер салона, ресторана или другого филиала получал имя, пояс, валюту и счётчики чужого филиала.
      // Отказ области запроса (403, 404) уходит человеку как есть, он не «база недоступна».
      const propertyId = await this.propertyId();
      const property =
        propertyId === null
          ? null
          : await this.prisma.db.property.findUnique({
              where: { id: propertyId },
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
    } catch (error) {
      // Отказ области запроса (403, 404) не прячем за «база недоступна»: это не сбой связи, а отсутствие доступа
      if (error instanceof HttpException) throw error;
      // Diagnostic reads never record incidents, call providers, or expose a driver error/URL.
      return result;
    }
  }
}

@Access('settings')
@Controller('system')
class DataConnectionController {
  constructor(@Inject(DataConnectionService) private readonly service: DataConnectionService) {}
  @Get('connection')
  @Header('Cache-Control', 'no-store')
  status() {
    return this.service.status();
  }
}

// Живость API (`GET /health`) живёт в ../health/health.module.ts — слито 18.09.2026 из двух реализаций.
@Module({
  controllers: [DataConnectionController],
  providers: [PrismaService, DataConnectionService],
})
export class DataConnectionModule {}
