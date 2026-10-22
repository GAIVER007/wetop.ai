import 'reflect-metadata';
import { Body, Controller, ForbiddenException, Get, Header, Inject, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import { Access } from '../auth/access.decorator';
import { serviceKeyKind } from '../auth/auth.guard';
import { VoiceIngestService } from './voice-ingest.service';

export const VOICE_KEY_REQUIRED = 'Нужен ключ голосового агента';

type ServiceRequest = { headers: Record<string, unknown> };

function requireVoiceKey(request: ServiceRequest): void {
  const key = serviceKeyKind(request.headers);
  if (key === null || key === 'unknown') throw new UnauthorizedException(VOICE_KEY_REQUIRED);
  if (key !== 'voice-ingest') throw new ForbiddenException(VOICE_KEY_REQUIRED);
}

/**
 * Служебный вход голосового воркера. Только ключ `VOICE_INGEST_KEY`: общий служебный и чужие узкие ключи сюда не входят,
 * сам ключ открывает два пути: приём событий и профиль агента. Ключ сверяется и здесь: без `AUTH_REQUIRED=1` замок входа молчит.
 */
@Access('service')
@Controller('voice')
export class VoiceIngestController {
  constructor(@Inject(VoiceIngestService) private readonly service: VoiceIngestService) {}

  @Post('events')
  events(@Req() request: ServiceRequest, @Body() dto: unknown) {
    requireVoiceKey(request);
    return this.service.ingest(dto);
  }

  /** Профиль голоса по агенту: объект, организация и настройки; ключ тот же, что у приёма событий */
  @Get('profile')
  @Header('Cache-Control', 'no-store')
  profile(@Req() request: ServiceRequest, @Query('agent') agent?: string) {
    requireVoiceKey(request);
    return this.service.profile(agent);
  }
}
