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
 * Проверка живости для healthcheck Docker на сервере, `ari.sh` и `status.sh` на Mac (plans/server-kz-2026-09-17.md
 * шаг 0, plans/server-kz-2026-09-18.md шаг 1; слито 18.09.2026 из двух реализаций).
 *
 * Почему отдельный адрес, а не `/inventory/summary`: тот читает фонд с джойнами и считался «пингом» по
 * недоразумению, а с включённым `AUTH_REQUIRED=1` отвечает 401 без сессии — контейнер API навсегда «нездоров»,
 * стойка и туннель ждут его здоровья (`depends_on: service_healthy`) и не поднимутся. Здесь `SELECT 1`, без входа.
 *
 * Обязательно трогает базу: 14.09.2026 Mac уснул, соединения пула умерли, API отвечал, но ни один запрос не
 * доходил до базы. Свой срок: срок пула (ADR-043) — 30 с на ответ базы, а healthcheck Docker ждёт 10 с; без
 * своего срока проверка отваливалась бы по таймауту Docker, не сказав ни слова о причине.
 *
 * Наружу не уходит ни строка подключения, ни ошибка драйвера (SECURITY.md §3). Через туннель маршрут не
 * выходит: тот пропускает только шесть публичных путей (SECURITY.md §11).
 *
 * Что здоровье даёт, а чего нет: красный healthcheck контейнер НЕ перезапускает — он виден в
 * `docker compose ps` и держит зависимые службы на старте; `restart: unless-stopped` срабатывает на выход
 * процесса. Мёртвые соединения пула лечит сам пул (ADR-043, packages/database/src/pool.ts).
 */
export type Health = {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  uptimeSeconds: number;
};

const HEALTH_TIMEOUT_DEFAULT_MS = 5000;

@Injectable()
export class HealthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** `SELECT 1` со своим сроком (`HEALTH_TIMEOUT_MS`, по умолчанию 5 с): мёртвый пул не должен вешать проверку. */
  async check(): Promise<Health> {
    const uptimeSeconds = Math.floor(process.uptime());
    const ms = Number(process.env['HEALTH_TIMEOUT_MS']) || HEALTH_TIMEOUT_DEFAULT_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.prisma.db.$queryRaw`SELECT 1`,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('health timeout')), ms);
        }),
      ]);
      return { status: 'ok', database: 'up', uptimeSeconds };
    } catch {
      return { status: 'degraded', database: 'down', uptimeSeconds };
    } finally {
      if (timer) clearTimeout(timer);
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
