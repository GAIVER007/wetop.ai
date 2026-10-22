import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { applyEvent, type CallValues, type VoiceEvent, type VoiceState } from './voice-events';

/**
 * Запись событий голосового воркера (DATA_MODEL VOICE-OWNER-APPROVAL-20261022). Идёт без организации в контексте,
 * значит служебной ролью базы: RLS её не ограничивает, а принадлежность агента, бизнеса и филиала режут триггеры.
 */
export const VOICE_INGEST_REPOSITORY = Symbol('VOICE_INGEST_REPOSITORY');

export interface AgentScope {
  organizationId: string;
  businessId: string;
  locationId: string;
}

/**
 * Профиль голоса агента для воркера: объект (имя бизнеса) и настройки из `voice_profiles`; без строки профиля умолчания.
 * Минимум для звонка: идентификаторы бизнеса и филиала воркеру не нужны и не отдаются.
 */
export interface AgentProfile {
  agentId: string;
  organizationId: string;
  objectName: string;
  greetingTail: string;
  voiceName: string;
  handoffPhone: string | null;
}

export interface RecordResult {
  callId: string;
  state: VoiceState;
  created: boolean;
  changed: boolean;
  callbackCreated: boolean;
}

export interface VoiceIngestRepository {
  /** null: агента нет; 'NO_LOCATION': агент без филиала, бизнес неизвестен */
  resolveAgent(agentId: string): Promise<AgentScope | null | 'NO_LOCATION'>;
  /** null: агента нет или он в архиве; 'NO_LOCATION': агент без филиала */
  profile(agentId: string): Promise<AgentProfile | null | 'NO_LOCATION'>;
  record(scope: AgentScope, event: VoiceEvent): Promise<RecordResult>;
}

/** Блокировка строки и гонка за уникальный ключ при нагрузке могут ждать дольше 5 секунд умолчания */
const TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 } as const;
const UNIQUE_VIOLATION = 'P2002';
const isUnique = (e: unknown): boolean =>
  typeof e === 'object' && e !== null && (e as { code?: string }).code === UNIQUE_VIOLATION;

@Injectable()
export class PrismaVoiceIngestRepository implements VoiceIngestRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async resolveAgent(agentId: string): Promise<AgentScope | null | 'NO_LOCATION'> {
    const agent = await this.prisma.db.sellerAgent.findUnique({
      where: { id: agentId },
      select: { organizationId: true, locationId: true, lifecycle: true, location: { select: { businessId: true } } },
    });
    // архивный агент событий не принимает: ключ воркера общий, лишнего он открывать не должен
    if (!agent || agent.lifecycle === 'archived') return null;
    if (!agent.locationId || !agent.location) return 'NO_LOCATION';
    return {
      organizationId: agent.organizationId,
      businessId: agent.location.businessId,
      locationId: agent.locationId,
    };
  }

  async profile(agentId: string): Promise<AgentProfile | null | 'NO_LOCATION'> {
    const agent = await this.prisma.db.sellerAgent.findUnique({
      where: { id: agentId },
      select: {
        organizationId: true,
        locationId: true,
        lifecycle: true,
        location: { select: { business: { select: { name: true } } } },
        voiceProfile: { select: { greetingTail: true, voiceName: true, handoffPhone: true } },
      },
    });
    // Звонки принимает только действующий агент (active): черновик, пауза и архив получают 404, как неизвестный.
    // События уже идущего звонка принимаются и у агента на паузе (resolveAgent), чтобы не терять конец разговора
    if (!agent || agent.lifecycle !== 'active') return null;
    if (!agent.locationId || !agent.location) return 'NO_LOCATION';
    return {
      agentId,
      organizationId: agent.organizationId,
      objectName: agent.location.business.name,
      greetingTail: agent.voiceProfile?.greetingTail ?? '',
      voiceName: agent.voiceProfile?.voiceName ?? 'Leda',
      handoffPhone: agent.voiceProfile?.handoffPhone ?? null,
    };
  }

  async record(scope: AgentScope, event: VoiceEvent): Promise<RecordResult> {
    // Два события одного звонка могут прийти одновременно: проигравший вставку повторяет и находит строку.
    try {
      return await this.recordOnce(scope, event);
    } catch (e) {
      if (!isUnique(e)) throw e;
      return this.recordOnce(scope, event);
    }
  }

  private recordOnce(scope: AgentScope, event: VoiceEvent): Promise<RecordResult> {
    return this.prisma.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM voice_calls WHERE agent_id = ${event.agentId}::uuid AND external_call_id = ${event.externalCallId} FOR UPDATE`;
      const row = await tx.voiceCall.findUnique({
        where: { agentId_externalCallId: { agentId: event.agentId, externalCallId: event.externalCallId } },
      });
      const existing: CallValues | null = row
        ? {
            state: row.state,
            direction: row.direction,
            receivedAt: row.receivedAt,
            answeredAt: row.answeredAt,
            endedAt: row.endedAt,
            durationSeconds: row.durationSeconds,
            dialedNumber: row.dialedNumber,
            callerMasked: row.callerMasked,
            endReason: row.endReason,
            errorCode: row.errorCode,
            transferRequested: row.transferRequested,
            callbackRequested: row.callbackRequested,
            consentAnnounced: row.consentAnnounced,
          }
        : null;
      const { next, changed } = applyEvent(existing, event);
      const values = {
        state: next.state,
        direction: next.direction,
        answeredAt: next.answeredAt,
        endedAt: next.endedAt,
        durationSeconds: next.durationSeconds,
        dialedNumber: next.dialedNumber,
        callerMasked: next.callerMasked,
        endReason: next.endReason,
        errorCode: next.errorCode,
        transferRequested: next.transferRequested,
        callbackRequested: next.callbackRequested,
        consentAnnounced: next.consentAnnounced,
      };
      let callId: string;
      if (!row) {
        const created = await tx.voiceCall.create({
          data: {
            ...values,
            organizationId: scope.organizationId,
            businessId: scope.businessId,
            locationId: scope.locationId,
            agentId: event.agentId,
            externalCallId: event.externalCallId,
            receivedAt: next.receivedAt,
          },
          select: { id: true },
        });
        callId = created.id;
      } else {
        callId = row.id;
        if (changed) await tx.voiceCall.update({ where: { id: row.id }, data: { ...values, updatedAt: new Date() } });
      }
      let callbackCreated = false;
      if (event.callback) {
        const made = await tx.voiceCallback.createMany({
          data: [
            {
              organizationId: scope.organizationId,
              businessId: scope.businessId,
              voiceCallId: callId,
              phone: event.callback.phone,
              name: event.callback.name,
              note: event.callback.note,
              createdAt: event.occurredAt,
            },
          ],
          skipDuplicates: true,
        });
        callbackCreated = made.count > 0;
      }
      return { callId, state: next.state, created: !row, changed, callbackCreated };
    }, TX_OPTIONS);
  }
}
