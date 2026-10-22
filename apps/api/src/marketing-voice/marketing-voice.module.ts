import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { MarketingVoiceController } from './marketing-voice.controller';
import { MARKETING_VOICE_REPOSITORY, PrismaMarketingVoiceRepository } from './marketing-voice.repository';
import { MarketingVoiceService } from './marketing-voice.service';
import { VoiceIngestController } from './voice-ingest.controller';
import { VOICE_INGEST_REPOSITORY, PrismaVoiceIngestRepository } from './voice-ingest.repository';
import { VoiceIngestService } from './voice-ingest.service';

/** Голосовой агент: приём событий воркера и журнал звонков для стойки (DATA_MODEL VOICE-OWNER-APPROVAL-20261022) */
@Module({
  controllers: [VoiceIngestController, MarketingVoiceController],
  providers: [
    PrismaService,
    { provide: VOICE_INGEST_REPOSITORY, useClass: PrismaVoiceIngestRepository },
    VoiceIngestService,
    { provide: MARKETING_VOICE_REPOSITORY, useClass: PrismaMarketingVoiceRepository },
    MarketingVoiceService,
  ],
})
export class MarketingVoiceModule {}
