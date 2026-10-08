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
  parseAssistantText,
  parseEditInstruction,
  siteGenerationBudget,
  type AssistantPayload,
  type SiteAiMode,
} from '@pms/domain';
import type { DbTx, Prisma } from '@pms/database';
import { currentUserId } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { SiteBriefService } from './brief.service';
import { GENERATION_BOT, type GenerationBot } from './generation.bot';
import { RUN_SELECT, SiteGenerationService, runUserText, runView } from './generation.service';
import { assertHourlyLimit, assertNoActiveSiteAi, assertUsageKnown } from './ai-guards';
import { assertSiteBuilderWrite, siteScope, siteTransaction, type SiteScope } from './scope';

/**
 * Разговор с ИИ сайта (MKT9.2, `docs/marketing/licensed-site-builder-v0.md` §4): Чат (ответ словами), План (вопросы или
 * план сборки), Оформление (три направления). Задача `site_ai_runs` версий не создаёт никогда; сборка по плану идёт
 * обычной задачей `generation_runs` с ключом, равным id плана (второй раз не ставится). Очередь, бюджет организации,
 * одна активная задача ИИ на сайт и предел часа общие со сборкой. Ответ модели проверяет воркер до записи.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;
export const CONVERSATION_LIMIT = 100;

export const AI_RUN_SELECT = {
  id: true,
  mode: true,
  status: true,
  baseVersionId: true,
  userText: true,
  assistantText: true,
  payload: true,
  model: true,
  tokensInput: true,
  tokensOutput: true,
  tokensCached: true,
  attempts: true,
  errorCode: true,
  errorMessage: true,
  createdAt: true,
  startedAt: true,
  finishedAt: true,
} as const;

type AiRunRow = Prisma.SiteAiRunGetPayload<{ select: typeof AI_RUN_SELECT }>;

export function aiRunView(run: AiRunRow) {
  return { ...run, payload: (run.payload ?? null) as AssistantPayload | null };
}

function strictBody(body: unknown, allowed: string[]): Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('Ожидается объект');
  const extra = Object.keys(body).filter((key) => !allowed.includes(key));
  if (extra.length) throw new BadRequestException(`Лишние поля: ${extra.join(', ')}`);
  return body as Record<string, unknown>;
}

/** Ответы на вопросы плана: до четырёх пар «вопрос → ответ», дописываются к запросу человека словами */
function answersText(raw: unknown): string | null {
  if (raw === undefined) return null;
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 4) throw new BadRequestException('answers: от 1 до 4 ответов');
  const lines = raw.map((a, i) => {
    if (!a || typeof a !== 'object' || Array.isArray(a)) throw new BadRequestException(`answers[${i}]: объект`);
    const { questionId, answer } = a as Record<string, unknown>;
    if (typeof questionId !== 'string' || !ID_RE.test(questionId)) throw new BadRequestException(`answers[${i}].questionId: id вопроса`);
    const text = parseAssistantText(answer, false);
    if (!text.ok || [...(text.value ?? '')].length > 400) throw new BadRequestException(`answers[${i}].answer: от 1 до 400 знаков`);
    return `${questionId}: ${text.value}`;
  });
  return `Ответы на вопросы:\n${lines.join('\n')}`;
}

@Injectable()
export class SiteAssistantService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SiteBriefService) private readonly briefs: SiteBriefService,
    @Inject(SiteGenerationService) private readonly generations: SiteGenerationService,
    @Inject(GENERATION_BOT) private readonly bot: GenerationBot | null,
  ) {}

  private activeSite(tx: DbTx, scope: SiteScope) {
    return tx.marketingSite.findFirst({
      where: { locationId: scope.locationId, state: { not: 'ARCHIVED' } },
      select: { id: true, latestVersionId: true },
    });
  }

  /** Новый запрос к ассистенту: 202 новая задача, 200 повтор того же ключа (та же задача, лимит не тратится) */
  async request(pointerSent: boolean, body: unknown) {
    const scope = siteScope(pointerSent);
    const input = strictBody(body, ['requestKey', 'mode', 'text', 'answers']);
    const requestKey = input['requestKey'];
    if (typeof requestKey !== 'string' || !UUID_RE.test(requestKey)) throw new BadRequestException('requestKey: UUID');
    const mode = input['mode'];
    if (mode !== 'CHAT' && mode !== 'PLAN' && mode !== 'DESIGN') throw new BadRequestException('mode: CHAT, PLAN или DESIGN');
    if (input['answers'] !== undefined && mode !== 'PLAN') throw new BadRequestException('answers: только у плана');
    // оформление можно попросить без слов: тогда ИИ опирается только на данные филиала
    const text = parseAssistantText(input['text'], mode === 'DESIGN' || input['answers'] !== undefined);
    if (!text.ok) throw new BadRequestException(text.message);
    const answers = answersText(input['answers']);
    const userText = [text.value, answers].filter(Boolean).join('\n\n') || 'Предложи три варианта оформления по данным гостиницы.';
    if ([...userText].length > 4000) throw new BadRequestException('Запрос вместе с ответами длиннее 4000 знаков');

    const existing = await siteTransaction(this.prisma, scope, false, async (tx) => {
      const site = await this.activeSite(tx, scope);
      if (!site) throw new ConflictException('Сначала создайте сайт');
      return tx.siteAiRun.findUnique({ where: { siteId_requestKey: { siteId: site.id, requestKey } }, select: AI_RUN_SELECT });
    });
    if (existing) return { created: false, run: aiRunView(existing) };

    await assertSiteBuilderWrite(this.prisma, scope);
    if (!this.bot) throw new ServiceUnavailableException('ИИ сайта не подключён');
    if (!siteGenerationBudget(process.env.SITE_GENERATION_DAILY_TOKEN_BUDGET).enabled)
      throw new ServiceUnavailableException('ИИ сайта выключен: лимит не настроен');
    const brief = await this.briefs.briefFor(scope, false);

    return siteTransaction(this.prisma, scope, true, async (tx) => {
      const found = await this.activeSite(tx, scope);
      if (!found) throw new ConflictException('Сначала создайте сайт');
      await tx.$queryRaw`SELECT id FROM marketing_sites WHERE id=${found.id}::uuid FOR UPDATE`;
      const site = (await this.activeSite(tx, scope))!;
      const again = await tx.siteAiRun.findUnique({ where: { siteId_requestKey: { siteId: site.id, requestKey } }, select: AI_RUN_SELECT });
      if (again) return { created: false, run: aiRunView(again) };
      await assertNoActiveSiteAi(tx, site.id);
      const userId = currentUserId();
      const now = new Date();
      await assertUsageKnown(tx, scope.organizationId, now);
      await assertHourlyLimit(tx, userId, scope.organizationId, now);
      const run = await tx.siteAiRun.create({
        data: {
          id: randomUUID(),
          siteId: site.id,
          mode: mode as SiteAiMode,
          requestKey,
          requestedById: userId,
          baseVersionId: site.latestVersionId,
          briefHash: brief.briefHash,
          userText,
        },
        select: AI_RUN_SELECT,
      });
      // текста запроса в журнале нет: режим, база, задача
      await this.audit(tx, scope, site.id, 'marketing.site.assistant.requested', {
        runId: run.id,
        siteId: site.id,
        mode,
        ...(site.latestVersionId ? { baseVersionId: site.latestVersionId } : {}),
      });
      return { created: true, run: aiRunView(run) };
    });
  }

  async status(pointerSent: boolean, id: string) {
    const scope = siteScope(pointerSent);
    if (!UUID_RE.test(id)) throw new NotFoundException('Запрос не найден');
    const run = await siteTransaction(this.prisma, scope, false, async (tx) => {
      const site = await this.activeSite(tx, scope);
      if (!site) return null;
      return tx.siteAiRun.findFirst({ where: { id, siteId: site.id }, select: AI_RUN_SELECT });
    });
    if (!run) throw new NotFoundException('Запрос не найден');
    return { run: aiRunView(run) };
  }

  /**
   * «Собрать по плану»: ровно одна задача сборки на план (ключ задачи равен id плана, повтор отдаёт её же). Сайт без
   * версии собирается первой сборкой, с версией правкой всего сайта; база должна быть той, что видел план. Текст сборки
   * можно поправить до 1800 знаков
   */
  async approve(pointerSent: boolean, id: string, body: unknown) {
    const scope = siteScope(pointerSent);
    const input = strictBody(body ?? {}, ['instruction']);
    if (!UUID_RE.test(id)) throw new NotFoundException('План не найден');
    const plan = await siteTransaction(this.prisma, scope, false, async (tx) => {
      const site = await this.activeSite(tx, scope);
      if (!site) return null;
      return tx.siteAiRun.findFirst({
        where: { id, siteId: site.id, mode: 'PLAN', status: 'SUCCEEDED' },
        select: { id: true, baseVersionId: true, payload: true },
      });
    });
    const payload = plan?.payload as AssistantPayload | null | undefined;
    if (!plan || payload?.kind !== 'PLAN') throw new NotFoundException('План не найден');
    const override = input['instruction'] === undefined ? null : parseEditInstruction(input['instruction'], PATCH_INSTRUCTION_MAX, false);
    if (override && !override.ok) throw new BadRequestException(override.message);
    const instruction = override?.ok ? override.text : payload.buildInstruction;
    const result = await this.generations.enqueueBuild(scope, {
      type: plan.baseVersionId ? 'PATCH' : 'INITIAL',
      requestKey: plan.id,
      expectedBriefHash: null,
      baseVersionId: plan.baseVersionId,
      instruction,
      target: null,
      planBaseVersionId: plan.baseVersionId,
    });
    return result;
  }

  /**
   * Разговор сайта одним списком по времени (MKT9.2 §39): сборки (с текстом человека, решение владельца MKT9.2) и
   * разговорные задачи, последние `limit` (до 100). Только сайт этого филиала с правом `settings`
   */
  async conversation(pointerSent: boolean, rawLimit: unknown) {
    const scope = siteScope(pointerSent);
    const n = typeof rawLimit === 'string' && /^[0-9]{1,3}$/.test(rawLimit) ? Number(rawLimit) : CONVERSATION_LIMIT;
    const limit = Math.min(Math.max(n, 1), CONVERSATION_LIMIT);
    return siteTransaction(this.prisma, scope, false, async (tx) => {
      const site = await this.activeSite(tx, scope);
      if (!site) return { items: [] };
      const [builds, talks] = await Promise.all([
        tx.generationRun.findMany({ where: { siteId: site.id }, orderBy: { createdAt: 'desc' }, take: limit, select: { ...RUN_SELECT, requestKey: true } }),
        tx.siteAiRun.findMany({ where: { siteId: site.id }, orderBy: { createdAt: 'desc' }, take: limit, select: AI_RUN_SELECT }),
      ]);
      const planIds = new Set(talks.filter((t) => t.mode === 'PLAN').map((t) => t.id));
      const items = [
        ...builds.map((b) => {
          const view = runView(b);
          return {
            id: b.id,
            kind: 'BUILD' as const,
            mode: b.type,
            status: b.status,
            userText: runUserText(b.type, b.instruction),
            assistantText: null,
            payload: null,
            baseVersionId: b.baseVersionId,
            outputVersionId: b.outputVersionId,
            target: 'target' in view ? (view.target ?? null) : null,
            fromPlanId: planIds.has(b.requestKey) ? b.requestKey : null,
            createdAt: b.createdAt,
            finishedAt: b.finishedAt,
            errorCode: b.errorCode,
            errorMessage: b.errorMessage,
            tokenUsage: { input: b.tokensInput, output: b.tokensOutput, cached: b.tokensCached },
          };
        }),
        ...talks.map((t) => ({
          id: t.id,
          kind: 'ASSISTANT' as const,
          mode: t.mode,
          status: t.status,
          userText: t.userText,
          assistantText: t.assistantText,
          payload: (t.payload ?? null) as AssistantPayload | null,
          baseVersionId: t.baseVersionId,
          outputVersionId: null,
          target: null,
          fromPlanId: null,
          createdAt: t.createdAt,
          finishedAt: t.finishedAt,
          errorCode: t.errorCode,
          errorMessage: t.errorMessage,
          tokenUsage: { input: t.tokensInput, output: t.tokensOutput, cached: t.tokensCached },
        })),
      ]
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
        .slice(-limit);
      return { items };
    });
  }

  private async audit(tx: DbTx, scope: SiteScope, siteId: string, action: string, after: Prisma.InputJsonObject) {
    await tx.auditLog.create({
      data: { organizationId: scope.organizationId, userId: currentUserId(), entityType: 'marketing_site', entityId: siteId, action, after },
    });
  }
}
