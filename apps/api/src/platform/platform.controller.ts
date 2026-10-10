import 'reflect-metadata';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Header,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  UseInterceptors,
} from '@nestjs/common';
import { ServiceDatabaseInterceptor } from '../database/service-database.interceptor';
import {
  isOrganizationNameShaped,
  normalizeOrganizationName,
  parseBusinessVertical,
  parseExtensionChange,
  validEmail,
  type BusinessVertical,
} from '@pms/domain';
import { currentOrganizationId, currentUserId } from '../auth/request-context';
import { requirePlatformAdmin } from './admin';
import {
  EXTENSIONS_REPOSITORY,
  type ExtensionsRepository,
  type OrganizationSummary,
} from './extensions.repository';
import { ExtensionsService, aiSellerView } from './extensions.service';
import { buildPlatformOverview } from './overview';
import { OrganizationCreation } from './organization-creation';
import { SiteBuilderLicenses, licenseLocationView } from './site-builder-licenses';
import { Access } from '../auth/access.decorator';

export { PLATFORM_ADMIN_ONLY } from './admin';
export const PLATFORM_NO_ORGANIZATION = 'Такой организации нет';
export const PLATFORM_NAME_MESSAGE = 'Название организации: от 1 до 200 знаков';
export const PLATFORM_OWNER_EMAIL_MESSAGE = 'Почта владельца: введите адрес вида имя@домен';
export const PLATFORM_OWN_ORGANIZATION = 'Свою организацию в архив убрать нельзя: вы потеряли бы доступ к платформе';
export const PLATFORM_ALREADY_ARCHIVED = 'Организация уже в архиве';
export const PLATFORM_NOT_ARCHIVED = 'Организация не в архиве';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Раздел «Платформа» главного администратора (DATA_MODEL §16, ADR-083): организации и их расширения. Открыт только
 * вошедшему с отметкой `platform_admins`: служебные ключи и выключенный замок (`AUTH_REQUIRED=0`) его не открывают.
 * Брони, гости, счета и переписка чужих гостиниц отсюда не видны — в ответе их нет по построению.
 */
@Access('platform')
// RLS (DATA_MODEL §17): главный администратор читает все организации — служебной ролью базы
@UseInterceptors(ServiceDatabaseInterceptor)
@Controller('platform')
export class PlatformController {
  constructor(
    @Inject(EXTENSIONS_REPOSITORY) private readonly repo: ExtensionsRepository,
    @Inject(ExtensionsService) private readonly extensions: ExtensionsService,
    @Inject(SiteBuilderLicenses) private readonly licenses: SiteBuilderLicenses,
    @Inject(OrganizationCreation) private readonly creation: OrganizationCreation,
  ) {}

  @Get('organizations')
  @Header('Cache-Control', 'no-store')
  async organizations() {
    requirePlatformAdmin();
    const now = new Date();
    return { items: (await this.repo.organizations()).map((o) => organizationJson(o, now)) };
  }

  /**
   * Обзор платформы (срез P1, план `plans/platform-superadmin-2026-10-10.md`): итоги по статусам, рост подключений
   * за 12 месяцев, направления, люди. Денег в ответе нет: платежи платформе не ведутся (ADR-102, Q-PA-2).
   */
  @Get('overview')
  @Header('Cache-Control', 'no-store')
  async overview() {
    requirePlatformAdmin();
    const now = new Date();
    const activeSince = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return buildPlatformOverview(await this.repo.overviewSource(activeSince), now);
  }

  /**
   * Создание организации главным администратором (ORG2, ADR-ORG2, Q-283): организация, первый филиал и владелец без
   * пароля, владельцу уходит ссылка «задайте пароль». Письмо не ушло: организация создана, `ownerLinkSent: false`.
   */
  @Post('organizations')
  async create(@Body() body: unknown) {
    requirePlatformAdmin();
    const parsed = parseCreate(body);
    if (!parsed.ok) throw new BadRequestException(parsed.message);
    const now = new Date();
    const made = await this.creation.create({ ...parsed.value, by: currentUserId() }, now);
    const saved = await this.repo.organization(made.organizationId);
    return { organization: organizationJson(saved!, now), ownerLinkSent: made.ownerLinkSent };
  }

  /** Ссылка «задайте пароль» ещё раз: только владельцу без пароля, прежняя ссылка гаснет */
  @Post('organizations/:id/owner-link')
  async ownerLink(@Param('id') id: string) {
    requirePlatformAdmin();
    if (!UUID.test(id)) throw new BadRequestException('Организация: ожидается идентификатор');
    if (!(await this.repo.organization(id))) throw new NotFoundException(PLATFORM_NO_ORGANIZATION);
    const now = new Date();
    const sent = await this.creation.resendOwnerLink(id, now);
    return { organization: organizationJson((await this.repo.organization(id))!, now), ownerLinkSent: sent.ownerLinkSent };
  }

  /** Название организации (ORG1, ADR-ORG1): пробелы сжимаются, то же название ничего не пишет в журнал */
  @Patch('organizations/:id')
  async rename(@Param('id') id: string, @Body() body: unknown) {
    requirePlatformAdmin();
    if (!UUID.test(id)) throw new BadRequestException('Организация: ожидается идентификатор');
    const raw = (body as { name?: unknown } | null)?.name;
    if (typeof raw !== 'string' || !isOrganizationNameShaped(raw)) throw new BadRequestException(PLATFORM_NAME_MESSAGE);
    const name = normalizeOrganizationName(raw);
    const org = await this.repo.organization(id);
    if (!org) throw new NotFoundException(PLATFORM_NO_ORGANIZATION);
    if (org.name !== name) await this.repo.rename({ organizationId: id, name, by: currentUserId(), now: new Date() });
    return organizationJson((await this.repo.organization(id))!, new Date());
  }

  /**
   * Архив вместо удаления (ORG1, ADR-ORG1, Q-282): организация получает `SUSPENDED`, её люди не входят, данные целы,
   * вернуть можно. Свою организацию убрать нельзя: сессия главного администратора перестала бы действовать.
   */
  @Post('organizations/:id/archive')
  async archive(@Param('id') id: string) {
    requirePlatformAdmin();
    if (!UUID.test(id)) throw new BadRequestException('Организация: ожидается идентификатор');
    const org = await this.repo.organization(id);
    if (!org) throw new NotFoundException(PLATFORM_NO_ORGANIZATION);
    if (id === currentOrganizationId()) throw new ConflictException(PLATFORM_OWN_ORGANIZATION);
    if (org.status === 'SUSPENDED') throw new ConflictException(PLATFORM_ALREADY_ARCHIVED);
    await this.repo.archive({ organizationId: id, by: currentUserId(), now: new Date() });
    return organizationJson((await this.repo.organization(id))!, new Date());
  }

  /** Возврат из архива: прежний статус, а при его потере «только чтение»: платный доступ сам не появляется */
  @Post('organizations/:id/restore')
  async restore(@Param('id') id: string) {
    requirePlatformAdmin();
    if (!UUID.test(id)) throw new BadRequestException('Организация: ожидается идентификатор');
    const org = await this.repo.organization(id);
    if (!org) throw new NotFoundException(PLATFORM_NO_ORGANIZATION);
    if (org.status !== 'SUSPENDED') throw new ConflictException(PLATFORM_NOT_ARCHIVED);
    await this.repo.restore({ organizationId: id, by: currentUserId(), now: new Date() });
    return organizationJson((await this.repo.organization(id))!, new Date());
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

  /** MKT9.2: гостиничные филиалы организации с лицензией конструктора сайта */
  @Get('organizations/:id/site-builder')
  @Header('Cache-Control', 'no-store')
  async siteBuilder(@Param('id') id: string) {
    requirePlatformAdmin();
    if (!UUID.test(id)) throw new BadRequestException('Организация: ожидается идентификатор');
    if (!(await this.repo.organization(id))) throw new NotFoundException(PLATFORM_NO_ORGANIZATION);
    const now = new Date();
    return { items: (await this.licenses.locations(id)).map((row) => licenseLocationView(row, now)) };
  }

  /**
   * MKT9.2: пробный, активировать, продлить или выключить конструктор сайта филиала: статус, дата «до» по Алматы и
   * заметка (номер счёта). Только главный администратор; филиал только гостиничный и только этой организации
   */
  @Put('organizations/:id/site-builder/:locationId')
  async changeSiteBuilder(@Param('id') id: string, @Param('locationId') locationId: string, @Body() body: unknown) {
    requirePlatformAdmin();
    if (!UUID.test(id) || !UUID.test(locationId)) throw new BadRequestException('Ожидается идентификатор');
    const now = new Date();
    const parsed = parseExtensionChange(body, now);
    if (!parsed.ok) throw new BadRequestException(parsed.errors.join('; '));
    if (!(await this.licenses.location(id, locationId))) throw new NotFoundException('Такого гостиничного филиала у организации нет');
    await this.licenses.save({ organizationId: id, locationId, change: parsed.value, by: currentUserId(), now });
    return licenseLocationView((await this.licenses.location(id, locationId))!, now);
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

function parseCreate(
  body: unknown,
): { ok: true; value: { name: string; ownerEmail: string; vertical: BusinessVertical } } | { ok: false; message: string } {
  const input = (body ?? {}) as { name?: unknown; ownerEmail?: unknown; vertical?: unknown };
  if (typeof input.name !== 'string' || !isOrganizationNameShaped(input.name)) return { ok: false, message: PLATFORM_NAME_MESSAGE };
  const ownerEmail = typeof input.ownerEmail === 'string' ? validEmail(input.ownerEmail) : null;
  if (!ownerEmail) return { ok: false, message: PLATFORM_OWNER_EMAIL_MESSAGE };
  const vertical = input.vertical === undefined ? 'HOSPITALITY' : parseBusinessVertical(input.vertical);
  if (!vertical) return { ok: false, message: 'Выберите направление бизнеса' };
  return { ok: true, value: { name: normalizeOrganizationName(input.name), ownerEmail, vertical } };
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
    ownerPending: o.ownerPending,
    verticals: o.verticals,
    locations: o.locations,
    aiSeller: {
      ...aiSellerView(o.aiSeller, now),
      note: o.aiSeller?.note ?? null,
      updatedAt: o.aiSeller?.updatedAt.toISOString() ?? null,
    },
  };
}
