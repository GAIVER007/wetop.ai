import 'reflect-metadata';
import {
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { formatAlert } from '@pms/domain';
import { INCIDENTS_REPOSITORY, type IncidentsRepository } from './incidents.repository';
import { ALERT_NOTIFIER, type AlertNotifier } from './guard.ports';
import { GuardService } from './guard.service';

/**
 * Сторож системы (срез 11): экран «Неисправности» стойки и дежурный агент читают отсюда.
 * «Принято» — человек в курсе, будить больше не надо; «Решено» — закрыть руками то, что проверка не перепроверит.
 */
@Controller('guard')
export class GuardController {
  private lastAlertTestAt = 0;
  constructor(
    @Inject(GuardService) private readonly guard: GuardService,
    @Inject(INCIDENTS_REPOSITORY) private readonly repo: IncidentsRepository,
    @Inject(ALERT_NOTIFIER) private readonly notifier: AlertNotifier,
  ) {}

  @Get('status')
  async status() {
    const open = await this.repo.open();
    const count = (p: (i: (typeof open)[number]) => boolean) => open.filter(p).length;
    return {
      ...this.guard.status(),
      open: {
        total: open.length,
        critical: count((i) => i.severity === 'CRITICAL'),
        escalated: count((i) => i.status === 'ESCALATED'),
        byClass: {
          A: count((i) => i.class === 'A'),
          B: count((i) => i.class === 'B'),
          C: count((i) => i.class === 'C'),
        },
      },
    };
  }

  @Get('incidents')
  list(@Query('status') status?: string, @Query('limit') limit?: string) {
    const n = Math.min(Math.max(Number(limit) || 100, 1), 500);
    return this.repo.list({ status: status === 'all' ? 'all' : 'open', limit: n });
  }

  @Post('incidents/:id/acknowledge')
  @HttpCode(200)
  async acknowledge(@Param('id', ParseUUIDPipe) id: string) {
    const r = await this.repo.acknowledge(id, new Date());
    if (!r) throw new NotFoundException('Неисправность не найдена');
    return r;
  }

  @Post('incidents/:id/resolve')
  @HttpCode(200)
  async resolve(@Param('id', ParseUUIDPipe) id: string) {
    await this.repo.resolve([id], 'STAFF', new Date());
    const r = await this.repo.get(id);
    if (!r) throw new NotFoundException('Неисправность не найдена');
    return r;
  }

  /** Проход сторожа прямо сейчас — для учений и дежурного агента */
  @Post('tick')
  @HttpCode(200)
  tick() {
    return this.guard.tick();
  }

  /** Пробное сообщение будильника: проверить токен и чат, не дожидаясь аварии */
  @Post('alert/test')
  @HttpCode(200)
  async alertTest() {
    // Быстрый туннель пробрасывает весь порт API (SECURITY.md §11): пробное сообщение нельзя крутить без конца
    const nowMs = Date.now();
    if (nowMs - this.lastAlertTestAt < 60_000)
      return {
        configured: this.notifier.configured,
        delivered: 0,
        failed: [],
        hint: 'не чаще раза в минуту',
      };
    this.lastAlertTestAt = nowMs;
    if (!this.notifier.configured)
      return {
        configured: false,
        delivered: 0,
        failed: [],
        hint: 'впишите TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в .env и перезапустите API',
      };
    const now = new Date();
    const text = formatAlert(
      [
        {
          id: 'test',
          kind: 'webhook.suspect',
          severity: 'WARNING',
          status: 'ESCALATED',
          title: 'Проверка будильника: это пробное сообщение, ничего не сломалось',
          alertedAt: null,
          acknowledgedAt: null,
          fixAttempts: 0,
          lastFixResult: null,
        },
      ],
      now,
    );
    return { configured: true, ...(await this.notifier.send(text)) };
  }
}
