import 'reflect-metadata';
import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  buildIntegrationHealth,
  buildReservationDiagnostics,
  todayAt,
  type IntegrationHealth,
  type ReservationDiagnostics,
} from '@pms/domain';
import { withSignedInUser } from '../auth/request-context';
import { WebhookHealthService } from '../channels/webhook-health.service';
import { DIAGNOSTICS_REPOSITORY, type DiagnosticsRepository } from './diagnostics.repository';
import {
  REQUESTER_CONTEXT_REPOSITORY,
  type RequesterContextRepository,
} from './requester-context.repository';

export interface IntegrationHealthAnswer {
  /** `null` — к организации каналы не подключены; иначе состояние без ключей и адресов */
  channex: IntegrationHealth | null;
}

/**
 * Диагностика для помощника поддержки (S5, plans/ai-agents-s5-diagnostics-2026-09-29.md). Пара «человек,
 * организация» — из подписи посетителя, сверяется с членством, как в S4; чтение идёт от имени организации.
 * Живых вызовов Channex нет: только база и снимок сторожа webhook.
 */
@Injectable()
export class DiagnosticsService {
  constructor(
    @Inject(REQUESTER_CONTEXT_REPOSITORY) private readonly members: RequesterContextRepository,
    @Inject(DIAGNOSTICS_REPOSITORY) private readonly repo: DiagnosticsRepository,
    @Optional() @Inject(WebhookHealthService) private readonly webhook: WebhookHealthService | null = null,
  ) {}

  /** `null` — обратившегося в организации нет (чужая или нет членства) */
  async integrationHealth(
    userId: string,
    organizationId: string,
    now: Date = new Date(),
  ): Promise<IntegrationHealthAnswer | null> {
    return withSignedInUser({ userId, organizationId }, async () => {
      if (!(await this.members.facts(userId, organizationId))) return null;
      const facts = await this.repo.integrationFacts(organizationId);
      if (!facts) return { channex: null };
      const snapshot = this.webhook?.snapshot();
      return {
        channex: buildIntegrationHealth(
          {
            ...facts,
            keyConfigured: !!process.env.CHANNEX_API_KEY?.trim(),
            webhook: {
              suspect: snapshot?.webhookSuspect ?? false,
              suspectReason: snapshot?.suspectReason ?? null,
              callbackReachable: snapshot?.callbackReachable ?? null,
            },
          },
          now,
        ),
      };
    });
  }

  /** `undefined` — обратившегося нет; `null` — брони с таким номером у организации нет */
  async reservation(
    userId: string,
    organizationId: string,
    confirmationNumber: string,
    now: Date = new Date(),
  ): Promise<ReservationDiagnostics | null | undefined> {
    return withSignedInUser({ userId, organizationId }, async () => {
      if (!(await this.members.facts(userId, organizationId))) return undefined;
      const found = await this.repo.reservationCard(organizationId, confirmationNumber);
      if (!found) return null;
      return buildReservationDiagnostics(found.card, todayAt(found.timezone, now));
    });
  }
}
