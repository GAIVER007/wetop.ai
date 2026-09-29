import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import { buildRequesterContext, type RequesterContext } from '@pms/domain';
import { withSignedInUser } from '../auth/request-context';
import { ExtensionsService } from '../platform/extensions.service';
import { REQUESTER_CONTEXT_REPOSITORY, type RequesterContextRepository } from './requester-context.repository';

/**
 * Контекст обратившегося для WETOP Support (S4, plans/ai-agents-s4-requester-context-2026-09-29.md).
 *
 * Чтение идёт внутри того же `RequestActor` (ADR-120), что и запрос человека: организация в контексте — под RLS выборки
 * не выходят за неё. Подписанная роль сюда не приходит: роль — из строки членства в базе, а пара без членства не
 * отвечает. Scope сервер не выбирает у бота — он ORGANIZATION; бизнесы и филиалы перечисляются из организации.
 */
@Injectable()
export class RequesterContextService {
  constructor(
    @Inject(REQUESTER_CONTEXT_REPOSITORY) private readonly repo: RequesterContextRepository,
    @Inject(ExtensionsService) private readonly extensions: ExtensionsService,
  ) {}

  async context(userId: string, organizationId: string): Promise<RequesterContext | null> {
    return withSignedInUser({ userId, organizationId, scope: 'ORGANIZATION' }, async () => {
      const rows = await this.repo.load(userId, organizationId);
      if (!rows) return null;
      const seller = await this.extensions.aiSeller(organizationId);
      return buildRequesterContext({
        ...rows,
        aiSeller: { access: seller.access, activeUntil: seller.activeUntil, daysLeft: seller.daysLeft },
      });
    });
  }
}
