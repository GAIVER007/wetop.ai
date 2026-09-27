import 'reflect-metadata';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Inject,
  NotFoundException,
  Param,
  Put,
  UseInterceptors,
} from '@nestjs/common';
import { ServiceDatabaseInterceptor } from '../database/service-database.interceptor';
import { parseExtensionChange } from '@pms/domain';
import { currentUserId } from '../auth/request-context';
import { requirePlatformAdmin } from './admin';
import {
  EXTENSIONS_REPOSITORY,
  type ExtensionsRepository,
  type OrganizationSummary,
} from './extensions.repository';
import { ExtensionsService, aiSellerView } from './extensions.service';

export { PLATFORM_ADMIN_ONLY } from './admin';
export const PLATFORM_NO_ORGANIZATION = 'Такой организации нет';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Раздел «Платформа» главного администратора (DATA_MODEL §16, ADR-083): организации и их расширения. Открыт только
 * вошедшему с отметкой `platform_admins`: служебные ключи и выключенный замок (`AUTH_REQUIRED=0`) его не открывают.
 * Брони, гости, счета и переписка чужих гостиниц отсюда не видны — в ответе их нет по построению.
 */
// RLS (DATA_MODEL §17): главный администратор читает все организации — служебной ролью базы
@UseInterceptors(ServiceDatabaseInterceptor)
@Controller('platform')
export class PlatformController {
  constructor(
    @Inject(EXTENSIONS_REPOSITORY) private readonly repo: ExtensionsRepository,
    @Inject(ExtensionsService) private readonly extensions: ExtensionsService,
  ) {}

  @Get('organizations')
  @Header('Cache-Control', 'no-store')
  async organizations() {
    requirePlatformAdmin();
    const now = new Date();
    return { items: (await this.repo.organizations()).map((o) => organizationJson(o, now)) };
  }

  /** Включить, продлить или выключить «ИИ-продавца» организации: статус, дата «до» и заметка (Q-183) */
  @Put('organizations/:id/extensions/ai-seller')
  async changeAiSeller(@Param('id') id: string, @Body() body: unknown) {
    requirePlatformAdmin();
    if (!UUID.test(id)) throw new BadRequestException('Организация: ожидается идентификатор');
    const now = new Date();
    const parsed = parseExtensionChange(body, now);
    if (!parsed.ok) throw new BadRequestException(parsed.errors.join('; '));
    if (!(await this.repo.organization(id))) throw new NotFoundException(PLATFORM_NO_ORGANIZATION);
    await this.repo.saveAiSeller({
      organizationId: id,
      change: parsed.value,
      by: currentUserId(),
      now,
    });
    // Э4: гостиница уходит продавцу сразу (active по новому состоянию), сверка догонит при отказе
    this.extensions.notifyAiSellerChanged(id);
    const saved = await this.repo.organization(id);
    return organizationJson(saved!, now);
  }

  /**
   * Оплата счётом (Q-141 — А, ADR-102): «оплата получена» — `ACTIVE`, организация снова пишет; «только чтение» —
   * `READ_ONLY`. Приостановка и пробный период отсюда не ставятся: это не оплата.
   */
  @Put('organizations/:id/status')
  async changeStatus(@Param('id') id: string, @Body() body: unknown) {
    requirePlatformAdmin();
    if (!UUID.test(id)) throw new BadRequestException('Организация: ожидается идентификатор');
    const input = (body ?? {}) as { status?: unknown; note?: unknown };
    if (input.status !== 'ACTIVE' && input.status !== 'READ_ONLY') {
      throw new BadRequestException('Статус: «ACTIVE» (оплата получена) или «READ_ONLY» (только чтение)');
    }
    const note = typeof input.note === 'string' && input.note.trim() ? input.note.trim().slice(0, 500) : null;
    if (!(await this.repo.organization(id))) throw new NotFoundException(PLATFORM_NO_ORGANIZATION);
    const now = new Date();
    await this.repo.saveStatus({ organizationId: id, status: input.status, note, by: currentUserId(), now });
    const saved = await this.repo.organization(id);
    return organizationJson(saved!, now);
  }
}

function organizationJson(o: OrganizationSummary, now: Date) {
  return {
    id: o.id,
    name: o.name,
    status: o.status,
    trialEndsAt: o.trialEndsAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
    members: o.members,
    owners: o.owners,
    aiSeller: {
      ...aiSellerView(o.aiSeller, now),
      note: o.aiSeller?.note ?? null,
      updatedAt: o.aiSeller?.updatedAt.toISOString() ?? null,
    },
  };
}
