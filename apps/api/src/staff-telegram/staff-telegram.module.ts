import 'reflect-metadata';
import { Body, Controller, Delete, Get, Headers, HttpCode, Inject, Module, Patch, Post } from '@nestjs/common';
import { Access } from '../auth/access.decorator';
import { Public } from '../auth/public.decorator';
import { PrismaService } from '../database/prisma.provider';
import { INCIDENTS_REPOSITORY, PrismaIncidentsRepository } from '../guard/incidents.repository';
import { StaffNotifyWorker } from './staff-notify.worker';
import { STAFF_BOT, StaffTelegramService, staffBotFromEnv } from './staff-telegram.service';

/**
 * «Профиль → Уведомления» (STAFF-TG-20261020): своё подключение Telegram у любого вошедшего сотрудника (право `self`).
 * Кто получит бронь, решают права филиала при записи и при отправке, а не этот экран.
 */
@Controller('profile/telegram')
@Access('self')
export class StaffTelegramController {
  constructor(@Inject(StaffTelegramService) private readonly service: StaffTelegramService) {}

  @Get()
  status() {
    return this.service.status();
  }

  @Post('code')
  @HttpCode(201)
  code() {
    return this.service.issueCode();
  }

  @Patch()
  preferences(@Body() body: unknown) {
    return this.service.setPreferences(body);
  }

  @Delete()
  disconnect() {
    return this.service.disconnect();
  }

  @Post('test')
  @HttpCode(200)
  test() {
    return this.service.test();
  }
}

/**
 * Вебхук бота WETOP: входа нет, пускает секрет `X-Telegram-Bot-Api-Secret-Token` (SECURITY.md, таблица публичных
 * адресов). Снаружи открыт ровно этот путь (deploy/cloudflared.example.yml).
 */
@Public()
@Controller('telegram/staff')
export class StaffTelegramWebhookController {
  constructor(@Inject(StaffTelegramService) private readonly service: StaffTelegramService) {}

  @Post('webhook')
  @HttpCode(200)
  webhook(@Headers('x-telegram-bot-api-secret-token') secret: string | undefined, @Body() body: unknown) {
    return this.service.webhook(secret, body);
  }
}

@Module({
  controllers: [StaffTelegramController, StaffTelegramWebhookController],
  providers: [
    PrismaService,
    StaffTelegramService,
    StaffNotifyWorker,
    // токен и секрет из окружения сервера (SECURITY.md §3); без токена null: экран говорит «подключается администратором»
    { provide: STAFF_BOT, useFactory: () => staffBotFromEnv() },
    // журнал неисправностей для staff.notify.failed: своя привязка порта, как у брони с сайта
    { provide: INCIDENTS_REPOSITORY, useClass: PrismaIncidentsRepository },
  ],
})
export class StaffTelegramModule {}
