import 'reflect-metadata';
import {
  Controller,
  Get,
  Header,
  Inject,
  Injectable,
  Module,
  ServiceUnavailableException,
} from '@nestjs/common';
import { databaseSchemaName } from '@pms/database';
import type { DataConnection } from '@pms/shared';
import { LUXX_APARTS_PROPERTY } from '@pms/imports';
import { Public } from '../auth/public.decorator';
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
      // схема не секрет: по ней прогон e2e убеждается, что пишет в pms_test, а не в рабочие данные (ADR-042)
      database: { connected: false, provider: databaseProvider(), schema: databaseSchemaName() },
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

/**
 * Живость API для сторожа снаружи процесса: Docker перезапускает контейнер, launchd — задачу.
 *
 * Мерить живость рабочим маршрутом (`/inventory/summary`, как было на Mac) нельзя по двум причинам.
 * С включённым `AUTH_REQUIRED=1` он отвечает 401 без сессии — контейнер API навсегда «нездоров», а
 * стойка и туннель ждут его здоровья и не поднимутся. И он ничего не говорит о базе, когда та молчит:
 * 14.09.2026 Mac уснул, соединения пула умерли, API отвечал, но ни один запрос не доходил до базы, и
 * лечилось это только перезапуском руками.
 *
 * Поэтому маршрут свой, публичный и обязательно трогает базу. Наружу он не выходит: туннель пропускает
 * только шесть публичных путей (`SECURITY.md` §11), `/health` среди них нет.
 */
const HEALTH_TIMEOUT_DEFAULT_MS = 5000;

@Injectable()
export class HealthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** `SELECT 1` со своим сроком: у пула таймаутов нет, и на мёртвых соединениях запрос висит вечно. */
  async ping(): Promise<void> {
    const ms = Number(process.env['HEALTH_TIMEOUT_MS']) || HEALTH_TIMEOUT_DEFAULT_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.prisma.db.$queryRaw`SELECT 1`,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('health timeout')), ms);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

@Controller()
class HealthController {
  constructor(@Inject(HealthService) private readonly service: HealthService) {}

  @Get('health')
  @Public()
  @Header('Cache-Control', 'no-store')
  async health() {
    try {
      await this.service.ping();
    } catch {
      // Причина не выходит наружу: в тексте ошибки драйвера бывает строка подключения с паролем.
      throw new ServiceUnavailableException({ status: 'down' });
    }
    return { status: 'ok' };
  }
}

@Module({
  controllers: [DataConnectionController, HealthController],
  providers: [PrismaService, DataConnectionService, HealthService],
})
export class DataConnectionModule {}
