import 'reflect-metadata';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Injectable,
  Module,
  Post,
} from '@nestjs/common';
import { canWrite, moveOnboarding, onboardingFlow } from '@pms/domain';
import type { DbTx } from '@pms/database';
import { Access } from '../auth/access.decorator';
import {
  actorMay,
  currentBusinessId,
  currentLocationId,
  currentOrganizationId,
  currentUserId,
  hasSignedInActor,
} from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';

type SharedDraft = {
  businessName: string;
  locationName: string;
  timezone: string;
  currency: string;
};
const FIELDS = ['businessName', 'locationName', 'timezone', 'currency'] as const;
function sharedDraft(raw: unknown): SharedDraft {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new BadRequestException('Укажите данные настройки');
  const source = raw as Record<string, unknown>;
  if (Object.keys(source).some((key) => !FIELDS.includes(key as (typeof FIELDS)[number])))
    throw new BadRequestException('Неизвестное поле настройки');
  const result = {} as SharedDraft;
  for (const key of FIELDS) {
    const value = source[key];
    if (typeof value !== 'string' || value.length > (key.endsWith('Name') ? 200 : 50))
      throw new BadRequestException('Проверьте данные настройки');
    result[key] = value.trim();
  }
  return result;
}
function validateShared(draft: SharedDraft) {
  if (!draft.businessName || !draft.locationName)
    throw new BadRequestException('Укажите название бизнеса и филиала');
  if (!Intl.supportedValuesOf('currency').includes(draft.currency))
    throw new BadRequestException('Укажите валюту');
  if (!draft.timezone) throw new BadRequestException('Укажите часовой пояс');
  try {
    new Intl.DateTimeFormat('ru', { timeZone: draft.timezone }).format();
  } catch {
    throw new BadRequestException('Укажите часовой пояс IANA');
  }
}
@Injectable()
export class SharedOnboardingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private async context(db: Pick<DbTx, 'location'> = this.prisma.db) {
    const organizationId = currentOrganizationId();
    const businessId = currentBusinessId();
    const locationId = currentLocationId();
    if (!hasSignedInActor() || !organizationId || !businessId || !locationId)
      throw new ForbiddenException('Выберите бизнес и филиал для настройки');
    const location = await db.location.findFirst({
      where: {
        id: locationId,
        businessId,
        status: 'ACTIVE',
        business: { organizationId, status: 'ACTIVE' },
      },
      select: {
        id: true,
        businessId: true,
        name: true,
        timezone: true,
        currency: true,
        business: {
          select: {
            name: true,
            vertical: true,
            organization: { select: { status: true, trialEndsAt: true } },
          },
        },
      },
    });
    if (!location) throw new ForbiddenException('Филиал недоступен');
    return location;
  }
  async status() {
    const location = await this.context();
    const flow = onboardingFlow(location.business.vertical);
    const saved = await this.prisma.db.onboardingProgress.findUnique({
      where: { locationId: location.id },
    });
    if (saved && saved.flowVersion !== flow.version)
      throw new ConflictException('Версия настройки изменилась. Обратитесь к команде WETOP.');
    return {
      vertical: flow.vertical,
      businessId: location.businessId,
      locationId: location.id,
      flowVersion: flow.version,
      currentStep: saved?.currentStep ?? flow.steps[0]!.id,
      draft:
        saved?.draft ??
        (flow.vertical === 'HOSPITALITY'
          ? {
              rows: [
                { name: '', kind: 'PRIVATE_ROOM', capacityAdults: '2', units: '1', price: '' },
              ],
            }
          : {
              businessName: location.business.name,
              locationName: location.name,
              timezone: location.timezone,
              currency: location.currency,
            }),
      completedAt: saved?.completedAt?.toISOString() ?? null,
      updatedAt: saved?.updatedAt.toISOString() ?? null,
      canEdit:
        actorMay('settings') &&
        canWrite(
          location.business.organization.status,
          location.business.organization.trialEndsAt,
          new Date(),
        ),
    };
  }
  async save(body: Record<string, unknown>) {
    if (!hasSignedInActor() || !actorMay('settings'))
      throw new ForbiddenException('Настройку выполняет владелец или управляющий');
    if (!body || Object.keys(body).some((key) => !['action', 'draft', 'updatedAt'].includes(key)))
      throw new BadRequestException('Неизвестное поле запроса');
    const action = body.action;
    if (!['save', 'next', 'back', 'complete'].includes(String(action)))
      throw new BadRequestException('Неизвестное действие');
    const location = await this.context();
    if (
      !canWrite(
        location.business.organization.status,
        location.business.organization.trialEndsAt,
        new Date(),
      )
    )
      throw new ForbiddenException('Организация доступна только для чтения');
    await this.prisma.db.$transaction(async (tx) => {
      // Serialize progress updates, including first insert. Recheck ownership inside the transaction.
      await tx.$executeRaw`SELECT 1 FROM locations WHERE id = ${location.id}::uuid FOR UPDATE`;
      const current = await this.context(tx);
      if (
        !canWrite(
          current.business.organization.status,
          current.business.organization.trialEndsAt,
          new Date(),
        )
      )
        throw new ForbiddenException('Организация доступна только для чтения');
      const flow = onboardingFlow(current.business.vertical);
      const saved = await tx.onboardingProgress.findUnique({ where: { locationId: current.id } });
      if ((saved?.updatedAt.toISOString() ?? null) !== (body.updatedAt ?? null))
        throw new ConflictException('Настройка изменена в другом окне. Обновите страницу.');
      if (saved && saved.flowVersion !== flow.version)
        throw new ConflictException('Версия настройки изменилась');
      if (saved?.completedAt) throw new ConflictException('Настройка уже завершена');
      const step = saved?.currentStep ?? flow.steps[0]!.id;
      let draft: Record<string, unknown>;
      if (flow.vertical === 'HOSPITALITY') {
        // The existing hotel adapter owns provisioning. This endpoint stores only its bounded draft.
        if (action !== 'save')
          throw new BadRequestException('Завершите настройку через форму отеля');
        if (
          !body.draft ||
          typeof body.draft !== 'object' ||
          Array.isArray(body.draft) ||
          JSON.stringify(body.draft).length > 32000
        )
          throw new BadRequestException('Некорректный черновик');
        const raw = body.draft as Record<string, unknown>;
        if (
          Object.keys(raw).some((key) => key !== 'rows') ||
          !Array.isArray(raw.rows) ||
          raw.rows.length > 100
        )
          throw new BadRequestException('Некорректные категории');
        draft = {
          rows: raw.rows.map((row: unknown) => {
            if (!row || typeof row !== 'object')
              throw new BadRequestException('Некорректная категория');
            const result: Record<string, string> = {};
            for (const key of ['name', 'kind', 'capacityAdults', 'units', 'price']) {
              const value = (row as Record<string, unknown>)[key];
              if (typeof value !== 'string' || value.length > 200)
                throw new BadRequestException('Некорректная категория');
              result[key] = value;
            }
            if (!['PRIVATE_ROOM', 'DORM_BED', 'APARTMENT'].includes(result.kind!))
              throw new BadRequestException('Некорректный тип категории');
            return result;
          }),
        };
      } else {
        draft = sharedDraft(body.draft);
        if (action === 'next' && step === 'business' && !draft.businessName)
          throw new BadRequestException('Укажите название бизнеса');
        if (action === 'complete' || (action === 'next' && step !== 'business'))
          validateShared(draft as SharedDraft);
      }
      const complete = action === 'complete';
      if (complete && step !== flow.steps.at(-1)!.id)
        throw new BadRequestException('Сначала завершите шаги настройки');
      const currentStep =
        action === 'next' || action === 'back' ? moveOnboarding(flow, step, action) : step;
      if (complete) {
        const values = draft as SharedDraft;
        // Existing operational data must never have its currency/timezone rewritten by onboarding.
        if (values.currency !== current.currency || values.timezone !== current.timezone) {
          const used = await tx.location.findUnique({
            where: { id: current.id },
            select: {
              property: { select: { id: true } },
              _count: { select: { services: true, appointments: true, workingHours: true } },
            },
          });
          if (used?.property || Object.values(used?._count ?? {}).some((n) => n > 0))
            throw new ConflictException(
              'В филиале уже есть рабочие данные. Измените валюту и часовой пояс через согласованную настройку.',
            );
        }
        await tx.business.update({
          where: { id: current.businessId },
          data: { name: values.businessName },
        });
        await tx.location.update({
          where: { id: current.id },
          data: { name: values.locationName, currency: values.currency, timezone: values.timezone },
        });
        await tx.auditLog.create({
          data: {
            userId: currentUserId(),
            entityType: 'Location',
            entityId: current.id,
            action: 'onboarding.complete',
            after: { vertical: flow.vertical, ...values },
          },
        });
      }
      const updatedAt = new Date(Math.max(Date.now(), (saved?.updatedAt.getTime() ?? 0) + 1));
      const data = {
        updatedAt,
        flowVersion: flow.version,
        currentStep,
        draft: draft as import('@pms/database').Prisma.InputJsonObject,
        completedAt: complete ? new Date() : null,
      };
      await tx.onboardingProgress.upsert({
        where: { locationId: current.id },
        create: { locationId: current.id, ...data },
        update: data,
      });
    });
    return this.status();
  }
}
@Access('self')
@Controller('onboarding')
class SharedOnboardingController {
  constructor(@Inject(SharedOnboardingService) private readonly service: SharedOnboardingService) {}
  @Get() status() {
    return this.service.status();
  }
  @Access('settings')
  @Post()
  save(@Body() body: Record<string, unknown>) {
    return this.service.save(body);
  }
}
@Module({
  controllers: [SharedOnboardingController],
  providers: [PrismaService, SharedOnboardingService],
})
export class SharedOnboardingModule {}
