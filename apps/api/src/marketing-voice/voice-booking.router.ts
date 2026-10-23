import 'reflect-metadata';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { VoiceBeautyService } from './voice-beauty.service';
import { VoiceBookingService } from './voice-booking.service';
import { VOICE_INGEST_REPOSITORY, type VoiceIngestRepository } from './voice-ingest.repository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Один адрес котировки и подтверждения на все направления: направление берётся из профиля агента на сервере, не из запроса.
 * Гостиница и салон подключены; ресторан добавляется отдельным срезом.
 */
@Injectable()
export class VoiceBookingRouter {
  constructor(
    @Inject(VOICE_INGEST_REPOSITORY) private readonly repo: VoiceIngestRepository,
    @Inject(VoiceBookingService) private readonly hotel: VoiceBookingService,
    @Inject(VoiceBeautyService) private readonly beauty: VoiceBeautyService,
  ) {}

  async quote(raw: unknown) {
    return (await this.target(raw)) === 'BEAUTY' ? this.beauty.quote(raw) : this.hotel.quote(raw);
  }

  async confirm(raw: unknown) {
    return (await this.target(raw)) === 'BEAUTY' ? this.beauty.confirm(raw) : this.hotel.confirm(raw);
  }

  private async target(raw: unknown): Promise<'BEAUTY' | 'HOSPITALITY'> {
    const agent = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).agent : undefined;
    if (typeof agent !== 'string' || !UUID.test(agent.trim())) throw new BadRequestException('agent: ожидался UUID');
    const profile = await this.repo.profile(agent.trim().toLowerCase());
    if (profile === null) throw new NotFoundException('Агент не найден');
    if (profile === 'NO_LOCATION') throw new UnprocessableEntityException('У агента не выбран филиал');
    if (profile.vertical === 'BEAUTY') return 'BEAUTY';
    if (profile.vertical === 'HOSPITALITY') return 'HOSPITALITY';
    throw new ConflictException('Бронь по телефону для этого направления пока не подключена');
  }
}
