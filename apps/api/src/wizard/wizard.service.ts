import 'reflect-metadata';
import { maskContacts } from '@pms/shared';
import type { Prisma } from '@pms/database';
import { chatPayload } from './wizard-chat-state';
import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { AttemptWindows } from '../auth/attempt-limits';
import { PrismaService } from '../database/prisma.provider';
import { wizardClientEvent, wizardConfig, wizardSurvey, WIZARD_STEPS } from './wizard-input';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const configObject = (value: unknown): Record<string, string> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, string>)
    : {};
const HOUR_MS = 3_600_000;
const TOO_MANY_MESSAGE = 'слишком много запросов, попробуйте позже';

/**
 * Пределы гостевого мастера (проверка слияния 26.09): без них поток открытий с одного адреса и поток сохранений в
 * одной сессии рос без края — новая строка сессии, черновика и события в базе на каждый вызов, и раз включат
 * `WIZARD_ENABLED`, это стало бы отказом в обслуживании. Открытие — по адресу (адрес нет — не считаем, как у входа);
 * сохранение — по сессии, чтобы работать даже без адреса посетителя.
 */
export const WIZARD_LIMITS = {
  opensPerIpPerHour: 20,
  savesPerSessionPerHour: 60,
} as const;

/** Guest drafts are isolated by a random bearer token. No model calls or trial issuance here. */
@Injectable()
export class WizardService {
  private readonly opens = new AttemptWindows(WIZARD_LIMITS.opensPerIpPerHour, HOUR_MS);
  private readonly saves = new AttemptWindows(WIZARD_LIMITS.savesPerSessionPerHour, HOUR_MS);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private enabled() {
    if (process.env.WIZARD_ENABLED !== '1')
      throw new ServiceUnavailableException('Гостевой мастер пока не включён');
  }
  private async session(
    token: string | undefined,
    db: Pick<PrismaService['db'], 'wizardSession'> = this.prisma.db,
  ) {
    this.enabled();
    if (!token || !/^wz_[a-f0-9]{64}$/.test(token))
      throw new UnauthorizedException('Откройте мастер заново');
    const row = await db.wizardSession.findUnique({
      where: { tokenHash: hash(token) },
      include: { draft: true },
    });
    if (!row || row.expiresAt <= new Date() || !row.draft)
      throw new UnauthorizedException('Сессия мастера истекла');
    return { ...row, draft: row.draft };
  }
  private view(row: Awaited<ReturnType<WizardService['session']>>) {
    const d = row.draft;
    return {
      scanSiteKey:
        process.env.WIZARD_SCAN_ENABLED === '1' &&
        process.env.TURNSTILE_SECRET_KEY &&
        process.env.WIZARD_PUBLIC_HOST
          ? (process.env.TURNSTILE_SITE_KEY ?? null)
          : null,
      chatSiteKey:
        process.env.WIZARD_CHAT_ENABLED === '1' &&
        process.env.TURNSTILE_SECRET_KEY &&
        process.env.WIZARD_PUBLIC_HOST
          ? (process.env.TURNSTILE_SITE_KEY ?? null)
          : null,
      generateSiteKey:
        process.env.WIZARD_GENERATE_ENABLED === '1' &&
        process.env.TURNSTILE_SECRET_KEY &&
        process.env.WIZARD_PUBLIC_HOST
          ? (process.env.TURNSTILE_SITE_KEY ?? null)
          : null,
      generated:
        d.generatedRevision === d.revision && d.generatedPrompt
          ? { prompt: d.generatedPrompt, knowledge: d.generatedKnowledge }
          : null,
      guestSessionId: row.id,
      lastStep: row.lastStep,
      draft: {
        businessName: d.businessName,
        niche: d.niche,
        description: d.description,
        wizardData: d.config,
        hasGenerated: d.generatedRevision === d.revision && !!d.generatedPrompt,
        testMessagesUsed: d.testMessagesUsed,
        revision: d.revision,
      },
    };
  }
  async open(token: string | undefined, ref: unknown, ip: string | null = null) {
    this.enabled();
    if (token) return this.scanStatus(token);
    if (ip && !this.opens.allow(ip, Date.now()))
      throw new HttpException(TOO_MANY_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
    const ttl = Number(process.env.WIZARD_SESSION_TTL_SECONDS);
    if (!Number.isSafeInteger(ttl) || ttl < 60 || ttl > 2592000)
      throw new ServiceUnavailableException('Срок хранения черновиков ещё не настроен');
    const guestToken = `wz_${randomBytes(32).toString('hex')}`;
    const row = await this.prisma.db.wizardSession.create({
      data: {
        tokenHash: hash(guestToken),
        ref: typeof ref === 'string' ? ref.slice(0, 200) : '',
        expiresAt: new Date(Date.now() + ttl * 1000),
        draft: { create: {} },
        events: {
          create: { eventType: 'wizard_started', deduplicationKey: `start:${hash(guestToken)}` },
        },
      },
      include: { draft: true },
    });
    return { ...this.view({ ...row, draft: row.draft! }), guestToken };
  }
  async status(token: string | undefined) {
    return this.scanStatus(token);
  }
  async save(token: string | undefined, body: unknown) {
    const row = await this.session(token);
    if (!this.saves.allow(row.id, Date.now()))
      throw new HttpException(TOO_MANY_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
    if (row.draft.agentId) throw new ConflictException('Агент уже сохранён в аккаунте');
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new BadRequestException('Ожидаются настройки');
    const input = body as { config?: unknown; revision?: unknown; step?: unknown };
    const config = wizardConfig(input.config);
    if (!Number.isSafeInteger(input.revision) || input.revision !== row.draft.revision)
      throw new ConflictException('Черновик изменился. Обновите страницу');
    const step = input.step;
    if (typeof step !== 'string' || !(WIZARD_STEPS as readonly string[]).includes(step))
      throw new BadRequestException('Неизвестный шаг');
    await this.prisma.db.$transaction(async (tx) => {
      const changed = await tx.wizardDraft.updateMany({
        where: { id: row.draft.id, revision: row.draft.revision, agentId: null },
        data: {
          config: { ...configObject(row.draft.config), ...config },
          ...(config.businessName !== undefined ? { businessName: config.businessName } : {}),
          ...(config.niche !== undefined ? { niche: config.niche } : {}),
          ...(config.description !== undefined ? { description: config.description } : {}),
          revision: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw new ConflictException('Черновик изменился. Обновите страницу');
      await tx.wizardSession.update({ where: { id: row.id }, data: { lastStep: step } });
      await tx.wizardEvent.create({
        data: {
          guestSessionId: row.id,
          eventType: 'review_edited',
          deduplicationKey: `review:${row.id}:${row.draft.revision + 1}`,
        },
      });
    });
    return this.status(token);
  }
  async scan(token: string | undefined, body: unknown, ipHash = hash('unknown')) {
    const row = await this.session(token);
    const revision =
      body && typeof body === 'object' ? (body as { revision?: unknown }).revision : undefined;
    if (revision !== row.draft.revision || row.draft.agentId)
      throw new ConflictException('Черновик изменился. Обновите страницу');
    const siteUrl = configObject(row.draft.config).siteUrl;
    if (!siteUrl) throw new BadRequestException('Укажите адрес сайта');
    if (!this.saves.allow(row.id, Date.now()))
      throw new HttpException(TOO_MANY_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
    return this.prisma.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM wizard_drafts WHERE id = ${row.draft.id}::uuid FOR UPDATE`;
      const fresh = await tx.wizardDraft.findUniqueOrThrow({ where: { id: row.draft.id } });
      if (fresh.revision !== revision || fresh.agentId)
        throw new ConflictException('Черновик изменился. Обновите страницу');
      const job = await tx.wizardJob.upsert({
        where: {
          draftId_kind_revision: {
            draftId: row.draft.id,
            kind: 'scan',
            revision: row.draft.revision,
          },
        },
        create: { draftId: row.draft.id, kind: 'scan', revision: row.draft.revision },
        update: {},
      });
      await tx.wizardEvent.createMany({
        data: [
          {
            guestSessionId: row.id,
            eventType: 'scan_requested',
            deduplicationKey: `scan:${job.id}`,
            payload: { ipHash },
          },
        ],
        skipDuplicates: true,
      });
      return { id: job.id, state: job.state };
    });
  }
  async generate(token: string | undefined, body: unknown, ipHash: string) {
    const row = await this.session(token);
    if (process.env.WIZARD_GENERATE_ENABLED !== '1')
      throw new ServiceUnavailableException('Генерация пока не включена');
    const revision =
      body && typeof body === 'object' ? (body as { revision?: unknown }).revision : undefined;
    if (!this.saves.allow(row.id, Date.now()))
      throw new HttpException(TOO_MANY_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
    return this.prisma.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM wizard_drafts WHERE id = ${row.draft.id}::uuid FOR UPDATE`;
      const fresh = await tx.wizardDraft.findUniqueOrThrow({ where: { id: row.draft.id } });
      if (fresh.revision !== revision || fresh.agentId)
        throw new ConflictException('Черновик изменился. Обновите страницу');
      const config = configObject(fresh.config);
      if (
        !fresh.businessName.trim() ||
        !fresh.niche.trim() ||
        !['sales', 'support'].includes(config.botType ?? '')
      )
        throw new BadRequestException('Укажите название, нишу и сценарий');
      const existing = await tx.wizardJob.findUnique({
        where: {
          draftId_kind_revision: {
            draftId: fresh.id,
            kind: 'generate',
            revision: fresh.revision,
          },
        },
      });
      if (existing) return { id: existing.id, state: existing.state };
      if ((await tx.wizardJob.count({ where: { draftId: fresh.id, kind: 'generate' } })) >= 5)
        throw new HttpException(
          'Использованы все пять сборок этого черновика',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      const job = await tx.wizardJob.create({
        data: { draftId: fresh.id, kind: 'generate', revision: fresh.revision },
      });
      await tx.wizardEvent.create({
        data: {
          guestSessionId: row.id,
          eventType: 'generation_requested',
          deduplicationKey: `generate:${job.id}`,
          payload: { ipHash },
        },
      });
      await tx.wizardSession.update({ where: { id: row.id }, data: { lastStep: 'generating' } });
      return { id: job.id, state: job.state };
    });
  }
  async message(token: string | undefined, body: unknown, ipHash: string) {
    const row = await this.session(token);
    if (process.env.WIZARD_CHAT_ENABLED !== '1')
      throw new ServiceUnavailableException('Тестовый чат пока не включён');
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new BadRequestException('Проверьте сообщение');
    const input = body as Record<string, unknown>;
    if (
      Object.keys(input).some(
        (key) => !['requestId', 'text', 'revision', 'challenge'].includes(key),
      ) ||
      typeof input.requestId !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(input.requestId) ||
      typeof input.text !== 'string' ||
      !input.text.trim() ||
      input.text.length > 2000 ||
      !Number.isSafeInteger(input.revision)
    )
      throw new BadRequestException('Проверьте сообщение');
    const requestId = input.requestId;
    const text = maskContacts(input.text.trim());
    const textHash = hash(input.text.trim());
    if (!this.saves.allow(row.id, Date.now()))
      throw new HttpException(TOO_MANY_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
    return this.prisma.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM wizard_drafts WHERE id = ${row.draft.id}::uuid FOR UPDATE`;
      const fresh = await tx.wizardDraft.findUniqueOrThrow({ where: { id: row.draft.id } });
      const key = `chat:${row.id}:${requestId}`;
      const existing = await tx.wizardEvent.findUnique({ where: { deduplicationKey: key } });
      if (existing) {
        const payload = chatPayload(existing.payload);
        if (payload.textHash !== textHash || payload.revision !== input.revision)
          throw new ConflictException('Повторный запрос изменён');
        return { requestId, state: payload.state };
      }
      if (fresh.agentId || fresh.revision !== input.revision)
        throw new ConflictException('Черновик изменился. Обновите страницу');
      if (fresh.generatedRevision !== fresh.revision || !fresh.generatedPrompt)
        throw new ConflictException('Сначала соберите помощника по актуальным данным');
      const reserved = await tx.wizardDraft.updateMany({
        where: { id: fresh.id, testMessagesUsed: { lt: 5 } },
        data: { testMessagesUsed: { increment: 1 } },
      });
      if (!reserved.count) throw new HttpException('Использованы все пять тестовых сообщений', 402);
      await tx.wizardMessage.create({
        data: { draftId: fresh.id, requestId, role: 'user', text, state: 'queued' },
      });
      await tx.wizardEvent.create({
        data: {
          guestSessionId: row.id,
          eventType: 'chat_requested',
          deduplicationKey: key,
          payload: {
            requestId,
            revision: fresh.revision,
            ipHash,
            textHash,
            state: 'queued',
            attempt: 0,
            leaseUntil: 0,
          },
        },
      });
      return { requestId, state: 'queued' };
    });
  }
  async scanStatus(token: string | undefined) {
    return this.prisma.db.$transaction(
      async (tx) => {
        const row = await this.session(token, tx);
        const job = await tx.wizardJob.findFirst({
          where: { draftId: row.draft.id, kind: 'scan' },
          orderBy: { createdAt: 'desc' },
        });
        const generation = await tx.wizardJob.findFirst({
          where: { draftId: row.draft.id, kind: 'generate' },
          orderBy: { createdAt: 'desc' },
        });
        return {
          ...this.view(row),
          chat: await this.chatView(tx, row),
          generationsUsed: await tx.wizardJob.count({
            where: { draftId: row.draft.id, kind: 'generate' },
          }),
          generation: generation
            ? {
                id: generation.id,
                state: row.draft.revision === generation.revision ? generation.state : 'stale',
                error: generation.maskedError,
              }
            : null,
          scan: job
            ? {
                id: job.id,
                state:
                  row.draft.revision !== job.revision + (job.state === 'succeeded' ? 1 : 0)
                    ? 'stale'
                    : job.state,
                error: job.maskedError,
              }
            : null,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  private async chatView(
    tx: Prisma.TransactionClient,
    row: Awaited<ReturnType<WizardService['session']>>,
  ) {
    const events = await tx.wizardEvent.findMany({
      where: {
        guestSessionId: row.id,
        eventType: 'chat_requested',
        payload: { path: ['revision'], equals: row.draft.revision },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const requests = events.map((event) => chatPayload(event.payload));
    const messages = await tx.wizardMessage.findMany({
      where: {
        draftId: row.draft.id,
        requestId: { in: requests.map((item) => item.requestId) },
        state: { in: ['queued', 'running', 'succeeded'] },
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });
    return {
      enabled: process.env.WIZARD_CHAT_ENABLED === '1',
      used: row.draft.testMessagesUsed,
      limit: 5,
      messages: requests
        .flatMap((request) =>
          ['user', 'assistant'].flatMap((role) =>
            messages.filter((m) => m.requestId === request.requestId && m.role === role),
          ),
        )
        .map((message) => ({
          requestId: message.requestId,
          role: message.role,
          text: message.text,
          state: message.state,
          sources:
            message.role === 'assistant'
              ? (requests.find((item) => item.requestId === message.requestId)?.sources ?? [])
              : [],
        })),
      failed: requests
        .filter((item) => item.state === 'failed')
        .slice(-5)
        .map((item) => item.requestId),
    };
  }
  async quota(token: string | undefined) {
    const row = await this.session(token);
    return { usedCount: row.draft.testMessagesUsed, limit: 5 };
  }
  /** Опрос: один ответ на сессию, повтор заменяет прежний (upsert), в журнале одно событие */
  async survey(token: string | undefined, body: unknown) {
    const row = await this.session(token);
    if (!this.saves.allow(row.id, Date.now()))
      throw new HttpException(TOO_MANY_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
    const answers = wizardSurvey(body);
    await this.prisma.db.$transaction([
      this.prisma.db.wizardSurvey.upsert({
        where: { guestSessionId: row.id },
        create: { guestSessionId: row.id, ...answers },
        update: answers,
      }),
      this.prisma.db.wizardEvent.createMany({
        data: [
          {
            guestSessionId: row.id,
            eventType: 'survey_answered',
            deduplicationKey: `survey:${row.id}`,
          },
        ],
        skipDuplicates: true,
      }),
    ]);
    return { ok: true };
  }
  /** Событие воронки с браузера: тип из белого списка, одно на сессию (повтор молча игнорируется) */
  async event(token: string | undefined, body: unknown) {
    const row = await this.session(token);
    if (!this.saves.allow(row.id, Date.now()))
      throw new HttpException(TOO_MANY_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
    const type = wizardClientEvent(body);
    await this.prisma.db.wizardEvent.createMany({
      data: [{ guestSessionId: row.id, eventType: type, deduplicationKey: `${type}:${row.id}` }],
      skipDuplicates: true,
    });
    return { ok: true };
  }
}
