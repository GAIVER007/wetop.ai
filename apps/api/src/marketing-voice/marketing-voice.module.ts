import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { SiteFormsModule } from '../site-forms/site-forms.module';
import { WebBookingModule } from '../web-booking/web-booking.module';
import { MarketingVoiceController } from './marketing-voice.controller';
import { MARKETING_VOICE_REPOSITORY, PrismaMarketingVoiceRepository } from './marketing-voice.repository';
import { MarketingVoiceService } from './marketing-voice.service';
import { PHONE_HASH_KEY, PHONE_LIMIT_STORE, PrismaPhoneLimitStore, VoicePhoneLimit } from './voice-phone-limit';
import { PrismaVoiceQuoteStore, VOICE_QUOTE_STORE, VoiceBeautyService } from './voice-beauty.service';
import { VoiceBookingController } from './voice-booking.controller';
import { VoiceFoodService } from './voice-food.service';
import { VoiceBookingRouter } from './voice-booking.router';
import { PrismaVoiceBookingStore, VOICE_BOOKING_STORE, VoiceBookingService } from './voice-booking.service';
import { VoiceIngestController } from './voice-ingest.controller';
import { VOICE_INGEST_REPOSITORY, PrismaVoiceIngestRepository } from './voice-ingest.repository';
import { VoiceIngestService } from './voice-ingest.service';

/** Голосовой агент: приём событий воркера и журнал звонков для стойки (DATA_MODEL VOICE-OWNER-APPROVAL-20261022) */
@Module({
  imports: [WebBookingModule, SiteFormsModule],
  controllers: [VoiceIngestController, VoiceBookingController, MarketingVoiceController],
  providers: [
    PrismaService,
    { provide: VOICE_INGEST_REPOSITORY, useClass: PrismaVoiceIngestRepository },
    VoiceIngestService,
    { provide: VOICE_BOOKING_STORE, useClass: PrismaVoiceBookingStore },
    VoiceBookingService,
    { provide: VOICE_QUOTE_STORE, useClass: PrismaVoiceQuoteStore },
    VoiceBeautyService,
    VoiceFoodService,
    VoiceBookingRouter,
    // суточный лимит на телефон (миграция 150): секрет из окружения, пока его нет лимит выключен
    { provide: PHONE_HASH_KEY, useFactory: () => process.env.VOICE_PHONE_HASH_KEY?.trim() || undefined },
    { provide: PHONE_LIMIT_STORE, useClass: PrismaPhoneLimitStore },
    VoicePhoneLimit,
    { provide: MARKETING_VOICE_REPOSITORY, useClass: PrismaMarketingVoiceRepository },
    MarketingVoiceService,
  ],
})
export class MarketingVoiceModule {}
