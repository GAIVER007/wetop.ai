import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import {
  extensionAccess,
  extensionDaysLeft,
  type ExtensionAccess,
  type ExtensionStatus,
} from '@pms/domain';
import { EXTENSIONS_REPOSITORY, type ExtensionRow, type ExtensionsRepository } from './extensions.repository';

/** Расширение «ИИ-продавец» организации для стойки и раздела (ADR-083, Q-183) */
export interface AiSellerAccessView {
  /** `active` — раздел целиком; `expired` — срок вышел, только чтение; `off` — раздела нет */
  access: ExtensionAccess;
  status: ExtensionStatus | null;
  activeUntil: string | null;
  /** Для напоминания владельцу организации за 7 дней и в последний день; бессрочно — `null` */
  daysLeft: number | null;
}

export function aiSellerView(row: ExtensionRow | null, now: Date): AiSellerAccessView {
  return {
    access: extensionAccess(row, now),
    status: row?.status ?? null,
    activeUntil: row?.activeUntil?.toISOString() ?? null,
    daysLeft: extensionDaysLeft(row, now),
  };
}

/** Состояние расширений организации. Срок проверяется при каждом запросе: вышедший срок действует сразу */
@Injectable()
export class ExtensionsService {
  constructor(@Inject(EXTENSIONS_REPOSITORY) private readonly repo: ExtensionsRepository) {}

  async aiSeller(organizationId: string, now: Date = new Date()): Promise<AiSellerAccessView> {
    return aiSellerView(await this.repo.aiSeller(organizationId), now);
  }
}
