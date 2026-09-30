import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { can, canWrite } from '@pms/domain';
import { withSignedInUser } from '../auth/request-context';
import { InboundBookingsService } from '../channels/inbound.service';
import { ChannexSyncService } from '../channels/sync.service';
import {
  REQUESTER_CONTEXT_REPOSITORY,
  type RequesterContextRepository,
} from './requester-context.repository';

/** Проверка «к этой организации подключены каналы» — в бою `isIntegrationActor`, в тестах подмена */
export const INTEGRATION_OWNER_CHECK = Symbol('INTEGRATION_OWNER_CHECK');
export type IntegrationOwnerCheck = (organizationId: string) => Promise<boolean>;

export type AssistantAction = 'channel_pull' | 'channel_sync';

export interface ActionRequest {
  userId: string;
  organizationId: string;
  /** Ключ идемпотентности от бота — id строки его журнала; повтор в течение часа возвращает прежний результат */
  idempotencyKey: string;
  days?: number;
}

export interface ActionAnswer {
  ok: true;
  action: AssistantAction;
  /** Повтор с тем же ключом идемпотентности: ничего не выполнялось, отдан прежний результат */
  replayed: boolean;
  received?: number;
  processed?: number;
  failed?: number;
  queued?: number;
  days?: number;
}

export const ACTION_RATE_LIMIT_MS = 10 * 60_000;
export const IDEMPOTENCY_TTL_MS = 60 * 60_000;
export const DEFAULT_SYNC_DAYS = 90;
export const MAX_SYNC_DAYS = 365;

export const NO_REQUESTER = 'Обратившегося в этой организации нет';
export const NO_RIGHT = 'У обратившегося нет права «каналы продаж»';
export const READ_ONLY = 'Организация в режиме «только чтение»: действия не выполняются';
export const NOT_CONNECTED = 'К этой организации каналы продаж не подключены';
export const TOO_OFTEN = 'Это действие уже выполнялось недавно: повторить можно через несколько минут';

/**
 * Действия помощника поддержки (S6, plans/ai-agents-s6-actions-2026-09-29.md §3.2). Только те, что в матрице:
 * подтянуть ленту Channex и полная выгрузка. Порядок проверок — членство → право → «только чтение» → интеграция →
 * лимит → идемпотентность → выполнение от имени организации. Лимиты и ключи идемпотентности живут в памяти процесса.
 */
@Injectable()
export class AssistantActionsService {
  private readonly recent = new Map<string, number>();
  private readonly done = new Map<string, { at: number; answer: ActionAnswer }>();

  constructor(
    @Inject(REQUESTER_CONTEXT_REPOSITORY) private readonly members: RequesterContextRepository,
    @Inject(INTEGRATION_OWNER_CHECK) private readonly integrationOwner: IntegrationOwnerCheck,
    @Inject(InboundBookingsService) private readonly inbound: InboundBookingsService,
    @Inject(ChannexSyncService) private readonly sync: ChannexSyncService,
  ) {}

  channelPull(request: ActionRequest, now = new Date()): Promise<ActionAnswer> {
    return this.run('channel_pull', request, now, async () => {
      const result = await this.inbound.pull(undefined, 'MANUAL');
      const failed = result.outcomes.filter((o) => o.result === 'failed').length;
      return { received: result.received, processed: result.outcomes.length - failed, failed };
    });
  }

  channelSync(request: ActionRequest, now = new Date()): Promise<ActionAnswer> {
    const days = request.days ?? DEFAULT_SYNC_DAYS;
    if (!Number.isInteger(days) || days < 1 || days > MAX_SYNC_DAYS)
      throw new BadRequestException(`days: целое от 1 до ${MAX_SYNC_DAYS}`);
    return this.run('channel_sync', request, now, async () => {
      const result = await this.sync.fullSync(days, 'manual');
      return { queued: result.availabilityValues + result.restrictionValues, days };
    });
  }

  private async run(
    action: AssistantAction,
    request: ActionRequest,
    now: Date,
    execute: () => Promise<Partial<ActionAnswer>>,
  ): Promise<ActionAnswer> {
    this.forget(now.getTime());
    return withSignedInUser({ userId: request.userId, organizationId: request.organizationId }, async () => {
      const facts = await this.members.facts(request.userId, request.organizationId);
      if (!facts) throw new NotFoundException(NO_REQUESTER);
      if (!can(facts.role, 'channels')) throw new ForbiddenException(NO_RIGHT);
      if (!canWrite(facts.organization.status, facts.organization.trialEndsAt, now))
        throw new ConflictException(READ_ONLY);
      if (!(await this.integrationOwner(request.organizationId))) throw new ConflictException(NOT_CONNECTED);

      // Ключ идемпотентности живёт внутри организации: один и тот же ключ у двух организаций — два разных
      // действия, а не чужой ответ из памяти (аудит 30.09.2026)
      const replayKey = `${action}:${request.organizationId}:${request.idempotencyKey}`;
      const replay = this.done.get(replayKey);
      if (replay) return { ...replay.answer, replayed: true };

      const limitKey = `${action}:${request.organizationId}`;
      const last = this.recent.get(limitKey);
      if (last !== undefined && now.getTime() - last < ACTION_RATE_LIMIT_MS)
        throw new HttpException(TOO_OFTEN, 429);
      this.recent.set(limitKey, now.getTime());

      const answer: ActionAnswer = { ok: true, action, replayed: false, ...(await execute()) };
      this.done.set(replayKey, { at: now.getTime(), answer });
      return answer;
    });
  }

  /** Память процесса не растёт: старые лимиты и ключи забываются */
  private forget(nowMs: number): void {
    for (const [key, at] of this.recent) if (nowMs - at > ACTION_RATE_LIMIT_MS) this.recent.delete(key);
    for (const [key, entry] of this.done) if (nowMs - entry.at > IDEMPOTENCY_TTL_MS) this.done.delete(key);
  }
}
