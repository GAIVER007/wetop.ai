import 'reflect-metadata';
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
  private async session(token: string | undefined) {
    this.enabled();
    if (!token || !/^wz_[a-f0-9]{64}$/.test(token))
      throw new UnauthorizedException('Откройте мастер заново');
    const row = await this.prisma.db.wizardSession.findUnique({
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
    if (token) return this.view(await this.session(token));
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
    return this.view(await this.session(token));
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
