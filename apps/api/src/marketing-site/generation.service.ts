import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  PATCH_INSTRUCTION_MAX,
  SECTION_INSTRUCTION_MAX,
  decodeDesignInstruction,
  decodeSectionInstruction,
  encodeDesignInstruction,
  encodeSectionInstruction,
  findSection,
  parseEditInstruction,
  siteGenerationBudget,
  type AssistantPayload,
  type DesignDirection,
} from '@pms/domain';
import type { DbTx, Prisma } from '@pms/database';
import { currentUserId } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { SiteBriefService } from './brief.service';
import { GENERATION_BOT, type GenerationBot } from './generation.bot';
import { assertSiteBuilderWrite, siteScope, siteTransaction, type SiteScope } from './scope';
import { assertHourlyLimit, assertNoActiveSiteAi, assertUsageKnown } from './ai-guards';

/**
 * Постановка и статус генерации сайта ИИ (MKT6, `docs/marketing/site-generation-v0.md`). Запрос человека только ставит
 * задачу `INITIAL` в очередь и читает её; модель зовёт воркер. Задача берётся только у сайта филиала из строгого
 * scope MKT3; тело не выбирает ни сайт, ни организацию, ни модель, ни вид задачи.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH_RE = /^[0-9a-f]{64}$/;

export const RUN_SELECT = {
  id: true,
  type: true,
  status: true,
  baseVersionId: true,
  instruction: true,
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

/**
 * Статус задачи без документа, брифа, промпта и текста команды человека (MKT9 §110). У SECTION наружу только цель
 * (страница и секция). Текст ошибки SCHEMA_INVALID это пары «путь код», не ответ модели
 */
export function runView(run: RunRow) {
  const { instruction, ...rest } = run;
  const target = run.type === 'SECTION' ? (decodeSectionInstruction(instruction)?.target ?? null) : null;
  return { ...rest, ...(run.type === 'SECTION' ? { target } : {}) };
}

/**
 * Текст человека у задачи сборки для разговора (MKT9.2): у SECTION без конверта, у первой сборки с оформлением только
 * пожелания. Видит только тот, кто видит сайт филиала с правом `settings`; в журнал аудита текст не идёт
 */
export function runUserText(type: string, instruction: string | null): string | null {
  if (type === 'SECTION') return decodeSectionInstruction(instruction)?.text ?? null;
  if (type === 'INITIAL') {
    const design = decodeDesignInstruction(instruction);
    if (design) return design.text;
  }
  return instruction;
}

export interface BuildParams {
  type: 'INITIAL' | 'PATCH' | 'SECTION';
  requestKey: string;
  expectedBriefHash: string | null;
  baseVersionId: string | null;
  instruction: string | null;
  target: { pageId: string; sectionId: string } | null;
  /** INITIAL: выбранное направление оформления из разговора (id задачи DESIGN и id направления) */
  design?: { runId: string; directionId: string } | null;
  /** Одобрение плана: задача сборки ставится по плану, база должна совпасть с базой плана */
  planBaseVersionId?: string | null;
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

  /**
   * Постановка задачи (MKT6 INITIAL, MKT9 PATCH и SECTION). Тело без `type` это INITIAL, как в MKT6. PATCH и SECTION
   * правят ровно голову черновика (`baseVersionId` равен голове, иначе 409); бриф сервер собирает сам и пишет его хэш
   * в задачу. Текст команды хранится в задаче (у SECTION конвертом с целью) и не попадает в журнал
   */
  async request(pointerSent: boolean, body: unknown) {
    const scope = siteScope(pointerSent);
    const raw = body !== null && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
    const type = raw['type'] === undefined ? 'INITIAL' : raw['type'];
    if (type !== 'INITIAL' && type !== 'PATCH' && type !== 'SECTION') throw new BadRequestException('type: INITIAL, PATCH или SECTION');
    const input = strictBody(
      body,
      type === 'INITIAL'
        ? ['requestKey', 'expectedBriefHash', 'type', 'instruction', 'designRunId', 'designId']
        : type === 'PATCH'
          ? ['requestKey', 'type', 'baseVersionId', 'instruction']
          : ['requestKey', 'type', 'baseVersionId', 'pageId', 'sectionId', 'instruction'],
    );
    const requestKey = input['requestKey'];
    if (typeof requestKey !== 'string' || !UUID_RE.test(requestKey)) throw new BadRequestException('requestKey: UUID');
    let expected: string | null = null;
    let baseVersionId: string | null = null;
    let instruction: string | null;
    let target: { pageId: string; sectionId: string } | null = null;
    let design: { runId: string; directionId: string } | null = null;
    if (type === 'INITIAL') {
      if (typeof input['expectedBriefHash'] !== 'string' || !HASH_RE.test(input['expectedBriefHash']))
        throw new BadRequestException('expectedBriefHash: sha256 в нижнем регистре');
      expected = input['expectedBriefHash'];
      // MKT9, окно «Создать сайт»: пожелания к первой версии необязательны; это данные, факты берутся из брифа
      const wishes = parseEditInstruction(input['instruction'], PATCH_INSTRUCTION_MAX, true);
      if (!wishes.ok) throw new BadRequestException(wishes.message);
      instruction = wishes.text;
      // MKT9.2: выбранное направление оформления берётся из ответа ИИ на сервере, браузер передаёт только id
      if (input['designRunId'] !== undefined || input['designId'] !== undefined) {
        if (typeof input['designRunId'] !== 'string' || !UUID_RE.test(input['designRunId']) || typeof input['designId'] !== 'string' || !/^[a-z0-9][a-z0-9-]{0,47}$/.test(input['designId']))
          throw new BadRequestException('designRunId и designId: выбранное оформление');
        design = { runId: input['designRunId'].toLowerCase(), directionId: input['designId'] };
      }
    } else {
      if (typeof input['baseVersionId'] !== 'string' || !UUID_RE.test(input['baseVersionId']))
        throw new BadRequestException('baseVersionId: id версии');
      baseVersionId = input['baseVersionId'].toLowerCase();
      const parsed = parseEditInstruction(input['instruction'], type === 'PATCH' ? PATCH_INSTRUCTION_MAX : SECTION_INSTRUCTION_MAX, type === 'SECTION');
      if (!parsed.ok) throw new BadRequestException(parsed.message);
      if (type === 'SECTION') {
        const pageId = input['pageId'];
        const sectionId = input['sectionId'];
        if (typeof pageId !== 'string' || typeof sectionId !== 'string' || !/^[a-z0-9][a-z0-9-]{0,47}$/.test(pageId) || !/^[a-z0-9][a-z0-9-]{0,47}$/.test(sectionId))
          throw new BadRequestException('pageId и sectionId: идентификаторы документа');
        target = { pageId, sectionId };
        instruction = encodeSectionInstruction(target, parsed.text);
      } else instruction = parsed.text;
    }

    return this.enqueueBuild(scope, { type, requestKey, expectedBriefHash: expected, baseVersionId, instruction, target, design });
  }

  /**
   * Постановка задачи сборки (общая для запроса человека и одобрения плана, MKT9.2). Повтор того же ключа отдаёт ту
   * же задачу в любом состоянии: ни второй строки, ни расхода лимита. Остальное под замком строки сайта: лицензия
   * (в транзакции записи), одна активная задача ИИ на сайт, предел часа и неизвестный расход по обеим таблицам
   */
  async enqueueBuild(scope: SiteScope, p: BuildParams): Promise<{ created: boolean; run: ReturnType<typeof runView> }> {
    const existing = await siteTransaction(this.prisma, scope, false, async (tx) => {
      const site = await this.activeSite(tx, scope);
      if (!site) throw new ConflictException('Сначала создайте сайт');
      return tx.generationRun.findUnique({ where: { siteId_requestKey: { siteId: site.id, requestKey: p.requestKey } }, select: RUN_SELECT });
    });
    if (existing) return { created: false, run: runView(existing) };

    // лицензия до сбора брифа: без неё ИИ сайта закрыт целиком
    await assertSiteBuilderWrite(this.prisma, scope);
    if (!this.bot) throw new ServiceUnavailableException('ИИ для генерации сайта не подключён');
    const budget = siteGenerationBudget(process.env.SITE_GENERATION_DAILY_TOKEN_BUDGET);
    if (!budget.enabled) throw new ServiceUnavailableException('Генерация сайтов выключена: лимит не настроен');

    // Бриф собирается заново: генерация по изменившимся данным не запускается; правка пишет текущий хэш сама
    const brief = await this.briefs.briefFor(scope, false);
    if (p.expectedBriefHash !== null && brief.briefHash !== p.expectedBriefHash)
      throw new ConflictException('Данные филиала изменились: обновите бриф и запустите генерацию заново');

    return siteTransaction(this.prisma, scope, true, async (tx) => {
      const found = await this.activeSite(tx, scope);
      if (!found) throw new ConflictException('Сначала создайте сайт');
      await tx.$queryRaw`SELECT id FROM marketing_sites WHERE id=${found.id}::uuid FOR UPDATE`;
      const site = (await this.activeSite(tx, scope))!;
      const again = await tx.generationRun.findUnique({
        where: { siteId_requestKey: { siteId: site.id, requestKey: p.requestKey } },
        select: RUN_SELECT,
      });
      if (again) return { created: false, run: runView(again) };
      if (p.type === 'INITIAL' && site.latestVersionId)
        throw new ConflictException('У сайта уже есть версия: первая генерация не заменяет её');
      if (p.planBaseVersionId !== undefined && p.planBaseVersionId !== (site.latestVersionId ?? null))
        throw new ConflictException({ code: 'BASE_VERSION_CHANGED', message: 'Сайт изменился после плана: попросите план заново' });
      if (p.type !== 'INITIAL') {
        if (!site.latestVersionId) throw new ConflictException('У сайта ещё нет версии: сначала создайте первую');
        if (site.latestVersionId !== p.baseVersionId)
          throw new ConflictException({ code: 'BASE_VERSION_CHANGED', message: 'Сайт уже изменили: обновите черновик и повторите' });
        const head = p.target
          ? await tx.marketingSiteVersion.findUniqueOrThrow({ where: { id: site.latestVersionId }, select: { spec: true } })
          : null;
        if (p.target && !findSection(head?.spec, p.target))
          throw new ConflictException({ code: 'UNKNOWN_SECTION', message: 'Такой секции на этой странице нет' });
      }
      let instruction = p.instruction;
      if (p.design) instruction = await this.designEnvelope(tx, site.id, p.design, p.instruction);
      await assertNoActiveSiteAi(tx, site.id);
      const userId = currentUserId();
      const now = new Date();
      await assertUsageKnown(tx, scope.organizationId, now);
      await assertHourlyLimit(tx, userId, scope.organizationId, now);
      const run = await tx.generationRun.create({
        data: {
          id: randomUUID(),
          siteId: site.id,
          type: p.type,
          requestKey: p.requestKey,
          requestedById: userId,
          briefHash: brief.briefHash,
          baseVersionId: p.baseVersionId,
          instruction,
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
          // текста команды в журнале нет (MKT9 §109): вид, база и у SECTION цель
          after: {
            runId: run.id,
            siteId: site.id,
            type: p.type,
            briefHash: brief.briefHash,
            ...(p.baseVersionId ? { baseVersionId: p.baseVersionId } : {}),
            ...(p.target ? { pageId: p.target.pageId, sectionId: p.target.sectionId } : {}),
            ...(p.design ? { designRunId: p.design.runId, designId: p.design.directionId } : {}),
            ...(p.planBaseVersionId !== undefined ? { fromPlan: true } : {}),
          },
        },
      });
      return { created: true, run: runView(run) };
    });
  }

  /** Направление из ответа ИИ этого сайта (задача DESIGN, успешная); браузер не передаёт тему, только выбор */
  private async designEnvelope(tx: DbTx, siteId: string, design: { runId: string; directionId: string }, text: string | null): Promise<string> {
    const run = await tx.siteAiRun.findFirst({
      where: { id: design.runId, siteId, mode: 'DESIGN', status: 'SUCCEEDED' },
      select: { payload: true },
    });
    const payload = run?.payload as AssistantPayload | null | undefined;
    const chosen: DesignDirection | undefined = payload?.kind === 'DESIGN' ? payload.directions.find((d) => d.id === design.directionId) : undefined;
    if (!chosen) throw new NotFoundException('Вариант оформления не найден');
    return encodeDesignInstruction(chosen, text);
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
