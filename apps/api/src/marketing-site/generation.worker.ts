import 'reflect-metadata';
import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  GENERATION_ERROR_TEXT,
  SECTION_DEFAULT_INSTRUCTION,
  SITE_EDIT_SCHEMA_VERSION,
  SITE_GENERATION_LEASE_MS,
  SITE_GENERATION_MAX_ATTEMPTS,
  SITE_GENERATION_SCHEMA_VERSION,
  SITE_SPEC_SCHEMA_VERSION,
  addUsage,
  checkEditedSpec,
  checkGeneratedSpec,
  decodeSectionInstruction,
  findSection,
  validateSiteSpec,
  decodeValidationErrors,
  encodeValidationErrors,
  generationRetry,
  generationTargetLocales,
  isGenerationErrorCode,
  sameUtcDay,
  siteGenerationBudget,
  siteSpecHash,
  utcDayStart,
  type GenerationErrorCode,
  type EditMode,
  type SiteBrief,
  type TokenUsage,
} from '@pms/domain';
import type { DbTx, Prisma } from '@pms/database';
import { assistant } from '@pms/integrations';
import { PrismaService } from '../database/prisma.provider';
import { SiteBriefService } from './brief.service';
import { GENERATION_BOT, type GenerationBot } from './generation.bot';
import { checkSpecAssets } from './asset-refs';

/**
 * Воркер генерации сайта (MKT6, `docs/marketing/site-generation-v0.md`). `generation_runs` и есть очередь в Postgres,
 * как `channel_outbox`. Ходит служебным путём базы (без организации в контексте), транзакцию во время вызова ИИ не
 * держит. Бюджет Q-274 считается по строкам задач организации в сутках UTC и проверяется перед каждым запросом к боту;
 * бот проверяет его ещё раз перед каждой ступенью каскада.
 */
const POLL_MS = 3_000;

interface Claimed {
  id: string;
  type: 'INITIAL' | 'SECTION' | 'PATCH' | 'SEO';
  baseVersionId: string | null;
  instruction: string | null;
  siteId: string;
  organizationId: string;
  businessId: string;
  locationId: string;
  attempts: number;
  startedAt: Date;
  briefHash: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  requestedById: string | null;
}

interface BotReply {
  status: 'ok' | 'error';
  spec: unknown;
  errorCode: string | null;
  model: string | null;
  usage: TokenUsage & { complete: boolean; paidCalls: number };
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

/** Ответ бота по контракту `site-generation/0`; не по контракту `null`, и расход тогда неизвестен */
export function parseBotReply(raw: unknown): BotReply | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const u = r['usage'] as Record<string, unknown> | undefined;
  if (!u || typeof u !== 'object') return null;
  if (!isInt(u['input']) || !isInt(u['output']) || !isInt(u['paidCalls']) || typeof u['complete'] !== 'boolean') return null;
  if (u['cached'] !== null && u['cached'] !== undefined && !isInt(u['cached'])) return null;
  if (r['status'] !== 'ok' && r['status'] !== 'error') return null;
  const model = typeof r['model'] === 'string' ? r['model'].slice(0, 100) : null;
  return {
    status: r['status'],
    spec: r['spec'],
    errorCode: typeof r['errorCode'] === 'string' ? r['errorCode'] : null,
    model,
    usage: {
      input: u['input'],
      output: u['output'],
      cached: (u['cached'] as number | null | undefined) ?? null,
      complete: u['complete'],
      paidCalls: u['paidCalls'],
    },
  };
}

@Injectable()
export class SiteGenerationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SiteGenerationWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private busy = false;
  /** Часы: подменяются в тестах */
  now: () => Date = () => new Date();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SiteBriefService) private readonly briefs: SiteBriefService,
    @Inject(GENERATION_BOT) private readonly bot: GenerationBot | null,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test' || process.env.SITE_GENERATION_WORKER?.trim() === 'off' || !this.bot) return;
    this.timer = setInterval(() => void this.tick().catch((e: unknown) => this.logger.warn(`Генерация сайтов: ${(e as Error).name}`)), POLL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Один проход: восстановить брошенные, взять одну задачу и довести её попытку до конца */
  async tick(): Promise<string | null> {
    if (this.busy) return null;
    this.busy = true;
    try {
      await this.recover();
      const run = await this.claim();
      if (run) await this.process(run);
      return run?.id ?? null;
    } finally {
      this.busy = false;
    }
  }

  /**
   * Аренда `RUNNING` истекла: воркер умер. Запрос к ИИ ещё не уходил: повтор (или TIMEOUT после третьей попытки);
   * уходил: расход неизвестен, `USAGE_UNAVAILABLE` (Q-274: неизвестный расход не считается нулём).
   */
  async recover(): Promise<number> {
    const now = this.now();
    return this.prisma.db.$transaction(async (tx) => {
      const lost = await tx.generationRun.findMany({
        where: { status: 'RUNNING', nextAttemptAt: { lte: now } },
        select: { id: true, siteId: true, attempts: true, dispatchedAt: true },
      });
      for (const run of lost) {
        if (run.dispatchedAt) await this.failTx(tx, run.id, run.siteId, 'USAGE_UNAVAILABLE', now);
        else if (run.attempts < SITE_GENERATION_MAX_ATTEMPTS)
          await tx.generationRun.updateMany({
            where: { id: run.id, status: 'RUNNING' },
            data: { status: 'QUEUED', nextAttemptAt: now },
          });
        else await this.failTx(tx, run.id, run.siteId, 'TIMEOUT', now);
      }
      return lost.length;
    });
  }

  /**
   * Захват: задача `QUEUED` с наступившим сроком под `FOR UPDATE SKIP LOCKED` (по одной), затем замок организации и проверка, что
   * у неё нет другой `RUNNING`: платные вызовы одной организации идут по одному, иначе два воркера потратили бы бюджет
   * дважды. Разные организации идут параллельно.
   */
  async claim(): Promise<Claimed | null> {
    const now = this.now();
    return this.prisma.db.$transaction(async (tx) => {
      const candidates = await tx.$queryRaw<Array<{ id: string; organization_id: string }>>`
        SELECT r.id, b.organization_id
          FROM generation_runs r
          JOIN marketing_sites s ON s.id = r.site_id
          JOIN locations l ON l.id = s.location_id
          JOIN businesses b ON b.id = l.business_id
         WHERE r.status = 'QUEUED' AND (r.next_attempt_at IS NULL OR r.next_attempt_at <= ${now})
         ORDER BY r.created_at, r.id
         LIMIT 20`;
      for (const candidate of candidates) {
        // Замок по одной строке: замок сразу на всех кандидатов спрятал бы задачи других организаций от соседнего
        // воркера. Состояние проверяется ещё раз под замком: сосед мог уже взять задачу и зафиксировать
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM generation_runs
           WHERE id = ${candidate.id}::uuid AND status = 'QUEUED' AND (next_attempt_at IS NULL OR next_attempt_at <= ${now})
             FOR UPDATE SKIP LOCKED`;
        if (locked.length === 0) continue;
        await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${candidate.organization_id}::uuid FOR UPDATE`;
        const busy = await tx.$queryRaw<Array<{ n: number }>>`
          SELECT count(*)::int AS n FROM generation_runs r
            JOIN marketing_sites s ON s.id = r.site_id
            JOIN locations l ON l.id = s.location_id
            JOIN businesses b ON b.id = l.business_id
           WHERE r.status = 'RUNNING' AND b.organization_id = ${candidate.organization_id}::uuid`;
        if ((busy[0]?.n ?? 0) > 0) continue;
        const before = await tx.generationRun.findUniqueOrThrow({ where: { id: candidate.id }, select: { startedAt: true, attempts: true } });
        const run = await tx.generationRun.update({
          where: { id: candidate.id },
          data: {
            status: 'RUNNING',
            attempts: before.attempts + 1,
            startedAt: before.startedAt ?? now,
            nextAttemptAt: new Date(now.getTime() + SITE_GENERATION_LEASE_MS),
            dispatchedAt: null,
          },
          select: {
            id: true,
            type: true,
            baseVersionId: true,
            instruction: true,
            siteId: true,
            attempts: true,
            startedAt: true,
            briefHash: true,
            errorCode: true,
            errorMessage: true,
            requestedById: true,
            site: { select: { location: { select: { id: true, businessId: true } } } },
          },
        });
        return {
          id: run.id,
          type: run.type,
          baseVersionId: run.baseVersionId,
          instruction: run.instruction,
          siteId: run.siteId,
          organizationId: candidate.organization_id,
          businessId: run.site.location.businessId,
          locationId: run.site.location.id,
          attempts: run.attempts,
          startedAt: run.startedAt!,
          briefHash: run.briefHash,
          errorCode: run.errorCode,
          errorMessage: run.errorMessage,
          requestedById: run.requestedById,
        };
      }
      return null;
    });
  }

  /**
   * Одна попытка захваченной задачи: всё, что можно решить без модели, решается до вызова. INITIAL как в MKT6;
   * PATCH и SECTION (MKT9) правят ровно свою базу: голова сменилась (ручное сохранение, другая правка) это
   * `BASE_VERSION_CHANGED` без модели, и так перед каждым повтором
   */
  async process(run: Claimed): Promise<void> {
    const now = this.now();
    if (!sameUtcDay(run.startedAt, now)) return this.fail(run, 'BUDGET_DAY_CHANGED');
    if (run.type !== 'INITIAL' && run.type !== 'PATCH' && run.type !== 'SECTION') return this.fail(run, 'MODEL_UNAVAILABLE');
    const editing = run.type !== 'INITIAL';

    const site = await this.prisma.db.marketingSite.findUnique({ where: { id: run.siteId }, select: { state: true, latestVersionId: true } });
    if (!site || site.state === 'ARCHIVED') return this.fail(run, 'BASE_VERSION_CHANGED');
    if (editing ? !run.baseVersionId || site.latestVersionId !== run.baseVersionId : site.latestVersionId)
      return this.fail(run, 'BASE_VERSION_CHANGED');

    let edit: { mode: EditMode; baseSpec: Record<string, unknown>; instruction: string } | null = null;
    if (editing) {
      const base = await this.prisma.db.marketingSiteVersion.findFirst({ where: { id: run.baseVersionId!, siteId: run.siteId }, select: { spec: true } });
      if (!base) return this.fail(run, 'BASE_VERSION_CHANGED');
      const valid = validateSiteSpec(base.spec);
      // база не проходит текущую проверку: модель не зовём, повтор бессмыслен
      if (!valid.ok) return this.fail(run, 'SCHEMA_INVALID', encodeValidationErrors(valid.errors));
      if (run.type === 'SECTION') {
        const decoded = decodeSectionInstruction(run.instruction);
        if (!decoded || !findSection(valid.spec, decoded.target)) return this.fail(run, 'SCHEMA_INVALID');
        edit = { mode: { mode: 'SECTION', target: decoded.target }, baseSpec: valid.spec, instruction: decoded.text ?? SECTION_DEFAULT_INSTRUCTION };
      } else {
        if (!run.instruction) return this.fail(run, 'SCHEMA_INVALID');
        edit = { mode: { mode: 'PATCH' }, baseSpec: valid.spec, instruction: run.instruction };
      }
    }

    let brief: SiteBrief;
    try {
      brief = await this.briefs.briefFor(
        { organizationId: run.organizationId, businessId: run.businessId, locationId: run.locationId },
        false,
        now.getTime(),
      );
    } catch {
      // филиал или бизнес больше не действуют: данные, по которым ставили задачу, изменились
      return this.fail(run, 'BRIEF_CHANGED');
    }
    if (brief.briefHash !== run.briefHash) return this.fail(run, 'BRIEF_CHANGED');

    const config = siteGenerationBudget(process.env.SITE_GENERATION_DAILY_TOKEN_BUDGET);
    if (!config.enabled || !this.bot) return this.fail(run, config.enabled ? 'MODEL_UNAVAILABLE' : 'BUDGET_EXCEEDED');
    const day = await this.budgetDay(run.organizationId, run.startedAt);
    if (day.unknown) return this.fail(run, 'USAGE_UNAVAILABLE');
    const remaining = config.budget - day.spent;
    if (remaining <= 0) return this.fail(run, 'BUDGET_EXCEEDED');

    const targetLocales = generationTargetLocales(brief.input);
    const validationErrors = run.errorCode === 'SCHEMA_INVALID' ? decodeValidationErrors(run.errorMessage) : [];
    // Отметка «запрос ушёл»: падение процесса до записи расхода даст USAGE_UNAVAILABLE, а не бесплатный повтор
    const marked = await this.prisma.db.generationRun.updateMany({
      where: { id: run.id, status: 'RUNNING' },
      data: { dispatchedAt: this.now() },
    });
    if (marked.count === 0) return;

    let raw: unknown;
    try {
      raw = edit
        ? await this.bot.edit({
            schemaVersion: SITE_EDIT_SCHEMA_VERSION,
            requestId: run.id,
            mode: edit.mode.mode,
            ...(edit.mode.mode === 'SECTION' ? { target: edit.mode.target } : {}),
            siteSpecSchemaVersion: SITE_SPEC_SCHEMA_VERSION,
            briefInput: brief.input,
            baseSpec: edit.baseSpec,
            instruction: edit.instruction,
            budgetRemainingTokens: remaining,
            validationErrors,
          })
        : await this.bot.generate({
            schemaVersion: SITE_GENERATION_SCHEMA_VERSION,
            requestId: run.id,
            siteSpecSchemaVersion: SITE_SPEC_SCHEMA_VERSION,
            briefInput: brief.input,
            targetLocales,
            budgetRemainingTokens: remaining,
            validationErrors,
            ...(run.instruction ? { instruction: run.instruction } : {}),
          });
    } catch (error) {
      if (error instanceof assistant.BotRejectedError) {
        // бот отказал до модели (ключ, тело): платного вызова не было
        await this.recordUsage(run, null, null);
        return this.retryOrFail(run, 'MODEL_UNAVAILABLE');
      }
      // нет связи, таймаут, 5xx: был ли платный вызов, неизвестно
      this.logger.warn(`Генерация ${run.id}: ответ ИИ потерян (${(error as Error).name})`);
      return this.fail(run, 'USAGE_UNAVAILABLE');
    }

    const reply = parseBotReply(raw);
    // Сначала расход, потом любое решение: оплаченный неудачный вызов не теряется из бюджета
    await this.recordUsage(run, reply?.usage ?? null, reply?.model ?? null);
    if (!reply || !reply.usage.complete) return this.fail(run, 'USAGE_UNAVAILABLE');
    if (reply.status === 'error') {
      const code: GenerationErrorCode =
        isGenerationErrorCode(reply.errorCode) && reply.errorCode !== 'BRIEF_CHANGED' && reply.errorCode !== 'BASE_VERSION_CHANGED'
          ? reply.errorCode
          : 'MODEL_UNAVAILABLE';
      return this.retryOrFail(run, code);
    }
    const checked = edit
      ? checkEditedSpec(reply.spec, edit.baseSpec, brief.input, edit.mode)
      : checkGeneratedSpec(reply.spec, brief.input, targetLocales);
    if (!checked.ok) {
      this.logger.warn(`Генерация ${run.id}: документ не прошёл проверку (${checked.errors.length} ошибок)`);
      return this.retryOrFail(run, 'SCHEMA_INVALID', encodeValidationErrors(checked.errors));
    }
    await this.succeed(run, checked.spec, checked.schemaVersion, reply.model);
  }

  /** Расход дня бюджета: задачи организации, начатые в эти сутки UTC; и был ли за сутки неизвестный расход */
  private async budgetDay(organizationId: string, startedAt: Date): Promise<{ spent: number; unknown: boolean }> {
    const from = utcDayStart(startedAt);
    const to = new Date(from.getTime() + 86_400_000);
    const rows = await this.prisma.db.$queryRaw<Array<{ spent: bigint | number | null; unknown: boolean }>>`
      SELECT COALESCE(SUM(COALESCE(r.tokens_input, 0) + COALESCE(r.tokens_output, 0)), 0) AS spent,
             COALESCE(bool_or(r.error_code = 'USAGE_UNAVAILABLE'), false) AS unknown
        FROM generation_runs r
        JOIN marketing_sites s ON s.id = r.site_id
        JOIN locations l ON l.id = s.location_id
        JOIN businesses b ON b.id = l.business_id
       WHERE b.organization_id = ${organizationId}::uuid AND r.started_at >= ${from} AND r.started_at < ${to}`;
    return { spent: Number(rows[0]?.spent ?? 0), unknown: rows[0]?.unknown === true };
  }

  /** Прибавить расход попытки к сумме задачи и снять отметку «запрос ушёл» */
  private async recordUsage(run: Claimed, usage: TokenUsage | null, model: string | null): Promise<void> {
    await this.prisma.db.$transaction(async (tx) => {
      const current = await tx.generationRun.findUniqueOrThrow({
        where: { id: run.id },
        select: { tokensInput: true, tokensOutput: true, tokensCached: true, status: true },
      });
      if (current.status !== 'RUNNING') return;
      const total = usage
        ? addUsage({ input: current.tokensInput, cached: current.tokensCached, output: current.tokensOutput }, usage)
        : { input: current.tokensInput, cached: current.tokensCached, output: current.tokensOutput };
      await tx.generationRun.update({
        where: { id: run.id },
        data: {
          tokensInput: total.input,
          tokensOutput: total.output,
          tokensCached: total.cached,
          dispatchedAt: null,
          ...(model ? { model } : {}),
        },
      });
    });
  }

  private async retryOrFail(run: Claimed, code: GenerationErrorCode, encoded?: string): Promise<void> {
    const retry = generationRetry(code, run.attempts, this.now());
    if (!retry.retry) return this.fail(run, code, encoded);
    await this.prisma.db.generationRun.updateMany({
      where: { id: run.id, status: 'RUNNING' },
      data: {
        status: 'QUEUED',
        nextAttemptAt: retry.at,
        dispatchedAt: null,
        errorCode: code,
        errorMessage: encoded || GENERATION_ERROR_TEXT[code],
      },
    });
    this.logger.log(`Генерация ${run.id}: ${code}, повтор после попытки ${run.attempts}`);
  }

  private async fail(run: Claimed, code: GenerationErrorCode, encoded?: string): Promise<void> {
    await this.prisma.db.$transaction((tx) => this.failTx(tx, run.id, run.siteId, code, this.now(), encoded));
    this.logger.log(`Генерация ${run.id}: ${code}`);
  }

  private async failTx(tx: DbTx, id: string, siteId: string, code: GenerationErrorCode, now: Date, encoded?: string): Promise<void> {
    const done = await tx.generationRun.updateMany({
      where: { id, status: 'RUNNING' },
      data: {
        status: 'FAILED',
        finishedAt: now,
        nextAttemptAt: null,
        errorCode: code,
        errorMessage: encoded || GENERATION_ERROR_TEXT[code],
      },
    });
    if (done.count > 0) await this.audit(tx, id, siteId, 'marketing.site.generation.failed', { errorCode: code });
  }

  /**
   * Успех одной транзакцией под замком сайта: задача всё ещё RUNNING без версии, сайт не в архиве, голова та же, что
   * при постановке (INITIAL: версий ещё нет; PATCH и SECTION: голова равна базе). Ручная правка, сделанная за время
   * работы ИИ, выигрывает: результат ИИ не применяется (`BASE_VERSION_CHANGED`). Картинки ещё раз по правилам черновика
   * MKT8. Публикация не трогается.
   */
  private async succeed(run: Claimed, spec: Record<string, unknown>, schemaVersion: string, model: string | null): Promise<void> {
    const outcome = await this.prisma.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM marketing_sites WHERE id = ${run.siteId}::uuid FOR UPDATE`;
      const current = await tx.generationRun.findUniqueOrThrow({
        where: { id: run.id },
        select: { status: true, outputVersionId: true, tokensInput: true, tokensOutput: true, tokensCached: true, briefHash: true },
      });
      if (current.status !== 'RUNNING' || current.outputVersionId) return 'gone' as const;
      const site = await tx.marketingSite.findUniqueOrThrow({ where: { id: run.siteId }, select: { state: true, latestVersionId: true } });
      const expected = run.type === 'INITIAL' ? null : run.baseVersionId;
      if (site.state === 'ARCHIVED' || site.latestVersionId !== expected) {
        await this.failTx(tx, run.id, run.siteId, 'BASE_VERSION_CHANGED', this.now());
        return 'base' as const;
      }
      const base = expected
        ? await tx.marketingSiteVersion.findFirstOrThrow({ where: { id: expected, siteId: run.siteId }, select: { id: true, revision: true } })
        : null;
      const assets = await checkSpecAssets(tx, run.locationId, spec, { historical: false, lock: true });
      if (assets.problems.length) {
        await this.failTx(tx, run.id, run.siteId, 'SCHEMA_INVALID', this.now(),
          encodeValidationErrors(assets.problems.map((p) => ({ path: p.path, code: `asset_${p.code}`, message: '' }))));
        return 'assets' as const;
      }
      const specHash = siteSpecHash(spec);
      const version = await tx.marketingSiteVersion.create({
        data: {
          id: randomUUID(),
          siteId: run.siteId,
          revision: (base?.revision ?? 0) + 1,
          parentVersionId: base?.id ?? null,
          schemaVersion,
          spec: spec as Prisma.InputJsonObject,
          specHash,
          source: 'AI',
          generationRunId: run.id,
          createdById: run.requestedById,
        },
        select: { id: true, revision: true },
      });
      await tx.marketingSite.update({ where: { id: run.siteId }, data: { latestVersionId: version.id } });
      const now = this.now();
      await tx.generationRun.update({
        where: { id: run.id },
        data: {
          status: 'SUCCEEDED',
          outputVersionId: version.id,
          finishedAt: now,
          nextAttemptAt: null,
          dispatchedAt: null,
          errorCode: null,
          errorMessage: null,
          ...(model ? { model } : {}),
        },
      });
      const target = run.type === 'SECTION' ? decodeSectionInstruction(run.instruction)?.target : undefined;
      await this.audit(tx, run.id, run.siteId, 'marketing.site.generation.succeeded', {
        type: run.type,
        ...(base ? { baseVersionId: base.id } : {}),
        ...(target ? { pageId: target.pageId, sectionId: target.sectionId } : {}),
        versionId: version.id,
        revision: version.revision,
        specHash,
        model,
        tokensInput: current.tokensInput,
        tokensOutput: current.tokensOutput,
        tokensCached: current.tokensCached,
      });
      return 'ok' as const;
    });
    this.logger.log(`Генерация ${run.id}: ${outcome === 'ok' ? 'SUCCEEDED' : outcome}`);
  }

  /** Журнал без брифа, промпта и документа: задача, сайт, версия, код ошибки, модель и счётчики токенов */
  private async audit(tx: DbTx, runId: string, siteId: string, action: string, extra: Record<string, unknown>): Promise<void> {
    const owner = await tx.$queryRaw<Array<{ organization_id: string; brief_hash: string | null }>>`
      SELECT b.organization_id, r.brief_hash FROM generation_runs r
        JOIN marketing_sites s ON s.id = r.site_id
        JOIN locations l ON l.id = s.location_id
        JOIN businesses b ON b.id = l.business_id
       WHERE r.id = ${runId}::uuid`;
    await tx.auditLog.create({
      data: {
        organizationId: owner[0]!.organization_id,
        userId: null,
        entityType: 'marketing_site',
        entityId: siteId,
        action,
        after: { runId, siteId, briefHash: owner[0]!.brief_hash, ...extra } as Prisma.InputJsonObject,
      },
    });
  }
}
