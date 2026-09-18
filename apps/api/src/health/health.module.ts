import 'reflect-metadata';
import {
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Injectable,
  Module,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator';
import { PrismaService } from '../database/prisma.provider';

/**
 * Проверка живости для Docker, туннеля и сторожа (plans/server-kz-2026-09-18.md, шаг 1).
 *
 * Почему отдельный адрес, а не `/inventory/summary`: тот читает фонд с джойнами и считался «пингом»
 * по недоразумению. Проверку живости дёргают раз в несколько секунд, поэтому здесь `SELECT 1`.
 * Наружу не уходит ни строка подключения, ни ошибка драйвера (SECURITY.md §3).
 */
export type Health = {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  uptimeSeconds: number;
};

@Injectable()
export class HealthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async check(): Promise<Health> {
    const uptimeSeconds = Math.floor(process.uptime());
    try {
      await this.prisma.db.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up', uptimeSeconds };
    } catch {
      return { status: 'degraded', database: 'down', uptimeSeconds };
    }
  }
}

@Controller('health')
class HealthController {
  constructor(@Inject(HealthService) private readonly service: HealthService) {}

  /** Без входа: у Docker и туннеля сессии нет (ADR-049, замок SessionGuard). */
  @Get()
  @Public()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async status(@Res({ passthrough: true }) response: Response): Promise<Health> {
    const health = await this.service.check();
    // 503 — принятый способ сказать балансировщику «не шли сюда», не роняя процесс
    if (health.status !== 'ok') response.status(503);
    return health;
  }
}

@Module({
  controllers: [HealthController],
  providers: [PrismaService, HealthService],
})
export class HealthModule {}
