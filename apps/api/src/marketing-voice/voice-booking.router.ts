import 'reflect-metadata';
import { BadRequestException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { VoiceBeautyService } from './voice-beauty.service';
import { VoiceFoodService } from './voice-food.service';
import { VoiceBookingService } from './voice-booking.service';
import { VOICE_INGEST_REPOSITORY, type VoiceIngestRepository } from './voice-ingest.repository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Один адрес котировки и подтверждения на все направления: направление берётся из профиля агента на сервере, не из запроса.
 * Гостиница, салон и ресторан.
 */
@Injectable()
export class VoiceBookingRouter {
  constructor(
    @Inject(VOICE_INGEST_REPOSITORY) private readonly repo: VoiceIngestRepository,
    @Inject(VoiceBookingService) private readonly hotel: VoiceBookingService,
    @Inject(VoiceBeautyService) private readonly beauty: VoiceBeautyService,
    @Inject(VoiceFoodService) private readonly food: VoiceFoodService,
  ) {}

  async quote(raw: unknown) {
    const target = await this.target(raw);
    if (target === 'BEAUTY') return this.beauty.quote(raw);
    if (target === 'FOOD_SERVICE') return this.food.quote(raw);
    return this.hotel.quote(raw);
  }

  async confirm(raw: unknown) {
    const target = await this.target(raw);
    if (target === 'BEAUTY') return this.beauty.confirm(raw);
    if (target === 'FOOD_SERVICE') return this.food.confirm(raw);
    return this.hotel.confirm(raw);
  }

  private async target(raw: unknown): Promise<'BEAUTY' | 'HOSPITALITY' | 'FOOD_SERVICE'> {
    const agent = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).agent : undefined;
    if (typeof agent !== 'string' || !UUID.test(agent.trim())) throw new BadRequestException('agent: ожидался UUID');
    const profile = await this.repo.profile(agent.trim().toLowerCase());
    if (profile === null) throw new NotFoundException('Агент не найден');
    if (profile === 'NO_LOCATION') throw new UnprocessableEntityException('У агента не выбран филиал');
    return profile.vertical;
  }
}
