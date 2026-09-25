import 'reflect-metadata';
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Inject,
  NotFoundException,
  Param,
  Put,
} from '@nestjs/common';
import { parseExtensionChange } from '@pms/domain';
import { actorIsPlatformAdmin, currentUserId } from '../auth/request-context';
import {
  EXTENSIONS_REPOSITORY,
  type ExtensionsRepository,
  type OrganizationSummary,
} from './extensions.repository';
import { aiSellerView } from './extensions.service';

export const PLATFORM_ADMIN_ONLY = 'Раздел «Платформа» — только для главного администратора платформы';
export const PLATFORM_NO_ORGANIZATION = 'Такой организации нет';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Раздел «Платформа» главного администратора (DATA_MODEL §16, ADR-083): организации и их расширения. Открыт только
 * вошедшему с отметкой `platform_admins`: служебные ключи и выключенный замок (`AUTH_REQUIRED=0`) его не открывают.
 * Брони, гости, счета и переписка чужих гостиниц отсюда не видны — в ответе их нет по построению.
 */
@Controller('platform')
export class PlatformController {
  constructor(@Inject(EXTENSIONS_REPOSITORY) private readonly repo: ExtensionsRepository) {}

  @Get('organizations')
  @Header('Cache-Control', 'no-store')
  async organizations() {
    requireAdmin();
    const now = new Date();
    return { items: (await this.repo.organizations()).map((o) => organizationJson(o, now)) };
  }

  /** Включить, продлить или выключить «ИИ-продавца» организации: статус, дата «до» и заметка (Q-183) */
  @Put('organizations/:id/extensions/ai-seller')
  async changeAiSeller(@Param('id') id: string, @Body() body: unknown) {
    requireAdmin();
    if (!UUID.test(id)) throw new BadRequestException('Организация: ожидается идентификатор');
    const now = new Date();
    const parsed = parseExtensionChange(body, now);
    if (!parsed.ok) throw new BadRequestException(parsed.errors.join('; '));
    if (!(await this.repo.organization(id))) throw new NotFoundException(PLATFORM_NO_ORGANIZATION);
    await this.repo.saveAiSeller({ organizationId: id, change: parsed.value, by: currentUserId(), now });
    const saved = await this.repo.organization(id);
    return organizationJson(saved!, now);
  }
}

function requireAdmin(): void {
  if (!actorIsPlatformAdmin()) throw new ForbiddenException(PLATFORM_ADMIN_ONLY);
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
