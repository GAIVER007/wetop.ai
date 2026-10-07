import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { siteGenerationBudget } from '@pms/domain';
import type { DbTx, Prisma } from '@pms/database';
import { currentUserId } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { SiteBriefService } from './brief.service';
import { GENERATION_BOT, type GenerationBot } from './generation.bot';
import { siteScope, siteTransaction, type SiteScope } from './scope';

/**
 * Постановка и статус генерации сайта ИИ (MKT6, `docs/marketing/site-generation-v0.md`). Запрос человека только ставит
 * задачу `INITIAL` в очередь и читает её; модель зовёт воркер. Задача берётся только у сайта филиала из строгого
 * scope MKT3; тело не выбирает ни сайт, ни организацию, ни модель, ни вид задачи.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH_RE = /^[0-9a-f]{64}$/;
/** Постановок на человека в организации за час: защита очереди от спама, повтор того же ключа не считается */
export const GENERATION_REQUESTS_PER_HOUR = 10;

export const RUN_SELECT = {
  id: true,
  type: true,
  status: true,
  briefHash: true,
  attempts: true,
  model: true,
  tokensInput: true,
  tokensCached: true,
  tokensOutput: true,
  outputVersionId: true,
  errorCode: true,
  errorMessage: true,
  createdAt: true,
  startedAt: true,
  finishedAt: true,
} as const;

type RunRow = Prisma.GenerationRunGetPayload<{ select: typeof RUN_SELECT }>;

/** Статус задачи без документа, брифа и промпта. Текст ошибки SCHEMA_INVALID это пары «путь код», не ответ модели */
export function runView(run: RunRow) {
  return { ...run };
}

function strictBody(body: unknown, allowed: string[]): Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('Ожидается объект');
  const extra = Object.keys(body).filter((key) => !allowed.includes(key));
  if (extra.length) throw new BadRequestException(`Лишние поля: ${extra.join(', ')}`);
  return body as Record<string, unknown>;
}

@Injectable()
export class SiteGenerationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SiteBriefService) private readonly briefs: SiteBriefService,
    @Inject(GENERATION_BOT) private readonly bot: GenerationBot | null,
  ) {}

  private activeSite(tx: DbTx, scope: SiteScope) {
    return tx.marketingSite.findFirst({
      where: { locationId: scope.locationId, state: { not: 'ARCHIVED' } },
      select: { id: true, latestVersionId: true },
    });
  }

  async request(pointerSent: boolean, body: unknown) {
    const scope = siteScope(pointerSent);
    const input = strictBody(body, ['requestKey', 'expectedBriefHash']);
    const requestKey = input['requestKey'];
    const expected = input['expectedBriefHash'];
    if (typeof requestKey !== 'string' || !UUID_RE.test(requestKey)) throw new BadRequestException('requestKey: UUID');
    if (typeof expected !== 'string' || !HASH_RE.test(expected))
      throw new BadRequestException('expectedBriefHash: sha256 в нижнем регистре');

    // Повтор того же ключа отдаёт ту же задачу в любом состоянии: ни второй строки, ни расхода лимита
    const existing = await siteTransaction(this.prisma, scope, false, async (tx) => {
      const site = await this.activeSite(tx, scope);
      if (!site) throw new ConflictException('Сначала создайте сайт');
      return tx.generationRun.findUnique({ where: { siteId_requestKey: { siteId: site.id, requestKey } }, select: RUN_SELECT });
    });
    if (existing) return { created: false, run: runView(existing) };

    if (!this.bot) throw new ServiceUnavailableException('ИИ для генерации сайта не подключён');
    const budget = siteGenerationBudget(process.env.SITE_GENERATION_DAILY_TOKEN_BUDGET);
    if (!budget.enabled) throw new ServiceUnavailableException('Генерация сайтов выключена: лимит не настроен');

    // Бриф собирается заново: человек видел его раньше, и генерация по изменившимся данным не запускается
    const brief = await this.briefs.briefFor(scope, false);
    if (brief.briefHash !== expected)
      throw new ConflictException('Данные филиала изменились: обновите бриф и запустите генерацию заново');

    return siteTransaction(this.prisma, scope, true, async (tx) => {
      const site = await this.activeSite(tx, scope);
      if (!site) throw new ConflictException('Сначала создайте сайт');
      const again = await tx.generationRun.findUnique({
        where: { siteId_requestKey: { siteId: site.id, requestKey } },
        select: RUN_SELECT,
      });
      if (again) return { created: false, run: runView(again) };
      if (site.latestVersionId)
        throw new ConflictException('У сайта уже есть версия: первая генерация не заменяет её');
      const active = await tx.generationRun.findFirst({
        where: { siteId: site.id, status: { in: ['QUEUED', 'RUNNING'] } },
        select: { id: true },
      });
      if (active) throw new ConflictException('Генерация этого сайта уже идёт: дождитесь её результата');
      const userId = currentUserId();
      const recent = await tx.generationRun.count({
        where: { requestedById: userId, createdAt: { gt: new Date(Date.now() - 3_600_000) } },
      });
      if (recent >= GENERATION_REQUESTS_PER_HOUR)
        throw new HttpException('Лимит запусков генерации за час исчерпан. Попробуйте позже.', 429);
      const run = await tx.generationRun.create({
        data: {
          id: randomUUID(),
          siteId: site.id,
          type: 'INITIAL',
          requestKey,
          requestedById: userId,
          briefHash: brief.briefHash,
        },
        select: RUN_SELECT,
      });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId,
          entityType: 'marketing_site',
          entityId: site.id,
          action: 'marketing.site.generation.requested',
          after: { runId: run.id, siteId: site.id, type: 'INITIAL', briefHash: brief.briefHash },
        },
      });
      return { created: true, run: runView(run) };
    });
  }

  async status(pointerSent: boolean, id: string) {
    const scope = siteScope(pointerSent);
    if (!UUID_RE.test(id)) throw new NotFoundException('Генерация не найдена');
    const run = await siteTransaction(this.prisma, scope, false, async (tx) => {
      const site = await this.activeSite(tx, scope);
      if (!site) return null;
      return tx.generationRun.findFirst({ where: { id, siteId: site.id }, select: RUN_SELECT });
    });
    if (!run) throw new NotFoundException('Генерация не найдена');
    return { run: runView(run) };
  }
}
