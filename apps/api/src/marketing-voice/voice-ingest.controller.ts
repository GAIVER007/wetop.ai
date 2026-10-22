import 'reflect-metadata';
import { Body, Controller, ForbiddenException, Inject, Post, Req, UnauthorizedException } from '@nestjs/common';
import { Access } from '../auth/access.decorator';
import { serviceKeyKind } from '../auth/auth.guard';
import { VoiceIngestService } from './voice-ingest.service';

export const VOICE_KEY_REQUIRED = 'Нужен ключ голосового агента';

/**
 * Служебный вход голосового воркера. Только ключ `VOICE_INGEST_KEY`: общий служебный и чужие узкие ключи сюда не входят,
 * сам ключ открывает один путь. Ключ сверяется и здесь: без `AUTH_REQUIRED=1` замок входа молчит.
 */
@Access('service')
@Controller('voice')
export class VoiceIngestController {
  constructor(@Inject(VoiceIngestService) private readonly service: VoiceIngestService) {}

  @Post('events')
  events(@Req() request: { headers: Record<string, unknown> }, @Body() dto: unknown) {
    const key = serviceKeyKind(request.headers);
    if (key === null || key === 'unknown') throw new UnauthorizedException(VOICE_KEY_REQUIRED);
    if (key !== 'voice-ingest') throw new ForbiddenException(VOICE_KEY_REQUIRED);
    return this.service.ingest(dto);
  }
}
