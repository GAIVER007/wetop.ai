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
  Post,
  Put,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ServiceDatabaseInterceptor } from '../database/service-database.interceptor';
import { isMonth, parseExtensionChange, visibleStatus } from '@pms/domain';
import { currentUserId } from '../auth/request-context';
import { requirePlatformAdmin } from './admin';
import {
  EXTENSIONS_REPOSITORY,
  type ExtensionsRepository,
  type OrganizationSummary,
} from './extensions.repository';
import { ExtensionsService, aiSellerView } from './extensions.service';
import { SiteBuilderLicenses, licenseLocationView } from './site-builder-licenses';
import { Access } from '../auth/access.decorator';
import { OrganizationsService } from './organizations.service';

export { PLATFORM_ADMIN_ONLY } from './admin';
export const PLATFORM_NO_ORGANIZATION = 'Такой организации нет';
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
    @Inject(OrganizationsService) private readonly organizations_: OrganizationsService,
  ) {}

  @Get('organizations')
  @Header('Cache-Control', 'no-store')
  async organizations() {
    requirePlatformAdmin();
    const now = new Date();
    return { items: (await this.repo.organizations()).map((o) => organizationJson(o, now)) };
  }

  /**
   * Сквозной обзор платформы: организации с бизнесами и филиалами, цифры за месяц (`?month=ГГГГ-ММ`, по умолчанию
   * текущий) и последние действия. Деньги разных валют не складываются, показатель без источника это `null`.
   */
  @Get('overview')
  @Header('Cache-Control', 'no-store')
  async overview(@Query('month') month?: string) {
    requirePlatformAdmin();
    if (month !== undefined && !isMonth(month)) throw new BadRequestException('Месяц: ожидается ГГГГ-ММ');
    return this.organizations_.overview(month);
  }

  /** Помесячный ряд по всем филиалам для диаграммы «Динамика»: отдельным запросом, он тяжелее обзора */
  @Get('overview/series')
  @Header('Cache-Control', 'no-store')
  async overviewSeries(@Query('month') month?: string) {
    requirePlatformAdmin();
    if (month !== undefined && !isMonth(month)) throw new BadRequestException('Месяц: ожидается ГГГГ-ММ');
    return { items: await this.organizations_.series(month) };
  }

  /**
   * Создать организацию: бизнес выбранного направления, первый филиал и владелец, доступ на введённую почту. Сохраняется
   * сразу и целиком, черновиков нет; повтор с тем же идентификатором возвращает уже созданное.
   */
  @Post('organizations')
  async createOrganization(@Body() body: unknown) {
    requirePlatformAdmin();
    return this.organizations_.create(body);
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

function organizationJson(o: OrganizationSummary, now: Date) {
  return {
    id: o.id,
    name: o.name,
    // пробного периода для экрана платформы нет: пробная работает до срока, затем только читает
    status: visibleStatus(o.status, o.trialEndsAt, now),
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
