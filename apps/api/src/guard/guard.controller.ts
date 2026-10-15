import 'reflect-metadata';
import { UseGuards } from '@nestjs/common';
import { IntegrationOwnerGuard } from '../channels/integration-owner';
import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { ChannelOperatorInterceptor } from '../channels/operator-access';
import { accessDeniedMessage, can, formatAlert } from '@pms/domain';
import type { SignedInUser } from '../auth/auth.service';
import { INCIDENTS_REPOSITORY, type IncidentsRepository } from './incidents.repository';
import { ALERT_NOTIFIER, type AlertNotifier } from './guard.ports';
import { GuardService } from './guard.service';
import { Access } from '../auth/access.decorator';

/**
 * Сторож системы (срез 11): экран «Неисправности» стойки и дежурный агент читают отсюда.
 * «Принято» — человек в курсе, будить больше не надо; «Решено» — закрыть руками то, что проверка не перепроверит.
 */
@Access('desk')
@UseGuards(IntegrationOwnerGuard)
@Controller('guard')
// только организация подключённого объекта и главный администратор (аудит 26.09, В-2 и С-3; ADR-095)
@UseInterceptors(ChannelOperatorInterceptor)
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

  /** Сверка остатков с каналом (X3, ADR-144): обзор «Каналов» показывает её владельцу подключённого объекта */
  @Get('reconciliation')
  reconciliation() {
    return this.guard.reconciliation();
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

  /** Проход сторожа прямо сейчас — для учений и дежурного агента; `?all=1` — и редкие проверки (сверка с каналом) */
  @Post('tick')
  @HttpCode(200)
  async tick(@Query('all') all?: string, @Req() request?: { user?: SignedInUser }) {
    const full = all === '1' || all === 'true';
    // полная сверка с Channex и починка полной выгрузкой — дело каналов (ADR-107): администратору — обычная проверка.
    // Роль — из `request.user`: обработчик идёт в служебном контексте ChannelOperatorInterceptor
    const user = request?.user;
    if (full && user && !can(user.role, 'channels'))
      throw new ForbiddenException(accessDeniedMessage('channels'));
    return this.guard.tick(new Date(), { all: full });
  }

  /** Пробное сообщение будильника: проверить токен и чат, не дожидаясь аварии */
  @Access('settings')
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
