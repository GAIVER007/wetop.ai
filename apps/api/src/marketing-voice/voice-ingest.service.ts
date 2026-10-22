import 'reflect-metadata';
import { BadRequestException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { parseVoiceEvent, VoiceEventError } from './voice-events';
import { VOICE_INGEST_REPOSITORY, type AgentProfile, type VoiceIngestRepository } from './voice-ingest.repository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface VoiceIngestAck {
  ok: true;
  callId: string;
  state: string;
  /** true: событие ничего нового не дало (повтор или запоздалое) */
  duplicate: boolean;
}

/**
 * Приём события звонка. Организацию, бизнес и филиал определяет сервер по агенту (тело их не выбирает), событие
 * идемпотентно, значения полей в сообщениях об ошибках не повторяются (там телефоны).
 */
@Injectable()
export class VoiceIngestService {
  constructor(@Inject(VOICE_INGEST_REPOSITORY) private readonly repo: VoiceIngestRepository) {}

  async ingest(dto: unknown): Promise<VoiceIngestAck> {
    let event;
    try {
      event = parseVoiceEvent(dto);
    } catch (e) {
      if (e instanceof VoiceEventError) throw new BadRequestException(e.message);
      throw e;
    }
    const scope = await this.repo.resolveAgent(event.agentId);
    if (scope === null) throw new NotFoundException('Агент не найден');
    if (scope === 'NO_LOCATION') throw new UnprocessableEntityException('У агента не выбран филиал');
    const result = await this.repo.record(scope, event);
    return {
      ok: true,
      callId: result.callId,
      state: result.state,
      duplicate: !result.created && !result.changed && !result.callbackCreated,
    };
  }

  /** Профиль голоса для воркера: звонок обслуживается по `agent_id`, организацию воркер сверяет с ответом */
  async profile(agent: unknown): Promise<AgentProfile> {
    if (typeof agent !== 'string' || !UUID.test(agent)) throw new BadRequestException('agent: ожидался UUID');
    const profile = await this.repo.profile(agent.toLowerCase());
    if (profile === null) throw new NotFoundException('Агент не найден');
    if (profile === 'NO_LOCATION') throw new UnprocessableEntityException('У агента не выбран филиал');
    return profile;
  }
}
