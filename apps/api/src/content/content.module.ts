import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import {
  CONTENT_BOT,
  CONTENT_CONTEXT,
  CONTENT_STORE,
  ContentDraftsController,
  ContentDraftsService,
  PrismaContentContext,
  PrismaContentStore,
  contentBotFromEnv,
} from './content-drafts';

/** «Маркетинг → Контент»: черновики постов с ИИ (CONTENT-DRAFTS-20261022, утверждено 23.10.2026) */
@Module({
  controllers: [ContentDraftsController],
  providers: [
    PrismaService,
    { provide: CONTENT_CONTEXT, useClass: PrismaContentContext },
    { provide: CONTENT_STORE, useClass: PrismaContentStore },
    { provide: CONTENT_BOT, useFactory: () => contentBotFromEnv() },
    ContentDraftsService,
  ],
})
export class ContentModule {}
