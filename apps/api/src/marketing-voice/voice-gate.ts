import 'reflect-metadata';
import { BadRequestException, ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { FormSite, SiteFormsService } from '../site-forms/site-forms.service';
import type { AgentProfile, VoiceIngestRepository } from './voice-ingest.repository';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CALL_ID = /^[A-Za-z0-9._:-]{1,64}$/;

export const obj = (raw: unknown): Record<string, unknown> => (raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {});
export const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max + 1) : '');

export interface VoiceGate {
  agent: string;
  call: string;
  profile: AgentProfile;
  fs: FormSite;
}

/**
 * Общие проверки запроса голоса к салону и ресторану: агент и звонок из запроса, профиль и филиал берёт сервер. Направление
 * должно совпасть с ожидаемым, бронь по телефону включена на объекте, цепочка филиала и организации действует.
 */
export async function voiceGate(
  repo: VoiceIngestRepository,
  forms: SiteFormsService,
  b: Record<string, unknown>,
  now: Date,
  vertical: 'BEAUTY' | 'FOOD_SERVICE',
): Promise<VoiceGate> {
  const agent = str(b.agent, 36).toLowerCase();
  if (!UUID.test(agent)) throw new BadRequestException('agent: ожидался UUID');
  const call = str(b.call, 64);
  if (!CALL_ID.test(call)) throw new BadRequestException('call: идентификатор звонка, 1-64 знака');
  const profile = await repo.profile(agent);
  if (profile === null) throw new NotFoundException('Агент не найден');
  if (profile === 'NO_LOCATION') throw new UnprocessableEntityException('У агента не выбран филиал');
  if (profile.vertical !== vertical) throw new ConflictException('Запись по телефону для этого направления не подключена');
  if (!profile.booking.enabled) throw new ConflictException('Бронирование по телефону на объекте выключено');
  const scope = await repo.resolveAgent(agent);
  if (scope === null || scope === 'NO_LOCATION') throw new NotFoundException('Агент не найден');
  const fs = await forms.voiceSite(scope.locationId, agent, now);
  if (fs.organizationId !== profile.organizationId || fs.vertical !== vertical) throw new NotFoundException('Агент не найден');
  return { agent, call, profile, fs };
}
