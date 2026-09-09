import 'reflect-metadata';
import { Controller, Get, HttpCode, Inject, Post, Query } from '@nestjs/common';
import { ChannexSyncService, PROVIDER } from './sync.service';
import { CHANNELS_REPOSITORY, type ChannelsRepository } from './channels.repository';

/** Channex: настройка объекта на staging и полная выгрузка ARI. Только localhost (роли — Q-061…064). */
@Controller('channels/channex')
export class ChannelsController {
  constructor(
    @Inject(ChannexSyncService) private readonly sync: ChannexSyncService,
    @Inject(CHANNELS_REPOSITORY) private readonly repo: ChannelsRepository,
  ) {}

  @Get('mapping')
  mapping() {
    return this.repo.mappings(PROVIDER);
  }

  @Post('setup')
  @HttpCode(200)
  setup(@Query('ratePlanCode') ratePlanCode?: string) {
    return this.sync.setup(ratePlanCode || undefined);
  }

  @Post('sync')
  @HttpCode(200)
  fullSync(@Query('days') days?: string) {
    return this.sync.fullSync(days ? Number(days) : undefined);
  }
}
