import { filterBeautyLocations } from '../beauty/access';
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
import {
  SCOPE_FORBIDDEN_MESSAGE,
  canWrite,
  isRestricted,
  moveOnboarding,
  onboardingFlow,
  roleAt,
} from '@pms/domain';
import type { DbTx } from '@pms/database';
import { Access } from '../auth/access.decorator';
import {
  actorMay,
  currentAssignments,
  currentBusinessId,
  currentLocationId,
  currentOrganizationId,
  currentRole,
  currentUserId,
  hasSignedInActor,
} from '../auth/request-context';
import { readBeautyReadiness } from './beauty-readiness';
import { PrismaService } from '../database/prisma.provider';

type SharedDraft = {
  businessName: string;
  locationName: string;
  timezone: string;
  currency: string;
  /** быстрый запуск салона (27.10.2026): адрес и телефон филиала, необязательны */
  address?: string;
  phone?: string;
};
const FIELDS = ['businessName', 'locationName', 'timezone', 'currency'] as const;
const CONTACT_FIELDS = ['address', 'phone'] as const;
function sharedDraft(raw: unknown): SharedDraft {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new BadRequestException('Укажите данные настройки');
  const source = raw as Record<string, unknown>;
  const known: readonly string[] = [...FIELDS, ...CONTACT_FIELDS];
  if (Object.keys(source).some((key) => !known.includes(key)))
    throw new BadRequestException('Неизвестное поле настройки');
  const result = {} as SharedDraft;
  for (const key of FIELDS) {
    const value = source[key];
    if (typeof value !== 'string' || value.length > (key.endsWith('Name') ? 200 : 50))
      throw new BadRequestException('Проверьте данные настройки');
    result[key] = value.trim();
  }
  // контакты филиала: адрес до 500 символов (locations.address VARCHAR(500)), телефон до 50
  for (const key of CONTACT_FIELDS) {
    const value = source[key];
    if (value === undefined) continue;
    if (typeof value !== 'string' || value.length > (key === 'address' ? 500 : 50))
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
  private async context(db: Pick<DbTx, 'location' | 'beautyPositionAssignment'> = this.prisma.db) {
    const organizationId = currentOrganizationId();
    const businessId = currentBusinessId();
    const locationId = currentLocationId();
    if (!hasSignedInActor() || !organizationId || !businessId || !locationId)
      throw new ForbiddenException('Выберите бизнес и филиал для настройки');
    // `GET /onboarding` открыт всем ролям (`self`), и перехватчик места не проверяет: человеку с областью доступа
    // (DATA_MODEL §31.1) черновик филиала без назначения не отдаём (A3/F6)
    const role = currentRole();
    const assignments = currentAssignments();
    if (
      role &&
      isRestricted(role, assignments) &&
      !roleAt(role, assignments, { businessId, locationId })
    )
      throw new ForbiddenException(SCOPE_FORBIDDEN_MESSAGE);
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
            organization: {
              select: { status: true, trialEndsAt: true, countryCode: true, locale: true },
            },
          },
        },
      },
    });
    if (!location) throw new ForbiddenException('Филиал недоступен');
    if (!(await filterBeautyLocations(db, [{id:location.id,businessId:location.businessId,vertical:location.business.vertical}])).length) throw new ForbiddenException('Нет назначения в этот салон или филиал');
    return location;
  }
  async status() {
    const location = await this.context();
    const flow = onboardingFlow(location.business.vertical);
    const saved = await this.prisma.db.onboardingProgress.findUnique({
      where: { locationId: location.id },
    });
    if (flow.vertical === 'BEAUTY') {
      return this.prisma.db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${currentOrganizationId()}::uuid FOR SHARE`;
          await tx.$queryRaw`SELECT id FROM businesses WHERE id = ${location.businessId}::uuid FOR SHARE`;
          await tx.$queryRaw`SELECT id FROM locations WHERE id = ${location.id}::uuid FOR SHARE`;
          return this.beautyStatus(tx);
        },
        { maxWait: 5000, timeout: 10000 },
      );
    }
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
    if (!['save', 'next', 'back', 'complete', 'apply-profile'].includes(String(action)))
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
    if (location.business.vertical === 'BEAUTY') return this.saveBeauty(body);
    if (action === 'apply-profile')
      throw new BadRequestException('Действие недоступно для этого направления');
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
              // проведённые документы бара в старой валюте (ADR-186): без курса пересчёт невозможен
              _count: {
                select: {
                  services: true,
                  appointments: true,
                  workingHours: true,
                  barStockMovements: true,
                  // деньги ресторана и кассы филиала в старой валюте (ADR-187): пересчёт без курса невозможен
                  restaurantPayments: true,
                  restaurantCashOps: true,
                },
              },
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
          data: {
            name: values.locationName,
            currency: values.currency,
            timezone: values.timezone,
            // быстрый запуск ресторана (27.10.2026): контакты филиала, если их прислали
            ...(values.address !== undefined ? { address: values.address || null } : {}),
            ...(values.phone !== undefined ? { phone: values.phone || null } : {}),
          },
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
  private async beautyStatus(db: DbTx) {
    const location = await this.context(db);
    const saved = await db.onboardingProgress.findUnique({ where: { locationId: location.id } });
    if (saved && ![1, 2].includes(saved.flowVersion))
      throw new ConflictException('Версия настройки не поддерживается. Обновите приложение.');
    const persisted = (saved?.draft ?? {}) as Record<string, unknown>;
    const actual = {
      businessName: location.business.name,
      locationName: location.name,
      timezone: location.timezone,
      currency: location.currency,
    };
    const configured = await readBeautyReadiness(
      db,
      location.businessId,
      location.id,
      location.currency,
      true,
    );
    let validProfile = true;
    try {
      validateShared(actual);
    } catch {
      validProfile = false;
    }
    const profileApplied =
      validProfile &&
      (saved?.flowVersion === 2
        ? persisted.profileApplied === true
        : Boolean(saved?.completedAt) || configured.ready);
    const completedFlowVersion =
      saved?.flowVersion === 2 && persisted.completedFlowVersion === 2
        ? 2
        : saved?.completedAt
          ? 1
          : null;
    const draft = Object.fromEntries(
      FIELDS.map((key) => [
        key,
        typeof persisted[key] === 'string' && !profileApplied ? persisted[key] : actual[key],
      ]),
    );
    const readiness = { ...configured, ready: profileApplied && configured.ready };
    const currentStep = !profileApplied
      ? !saved || saved.currentStep === 'welcome'
        ? 'welcome'
        : 'profile'
      : (readiness.steps.find((step) => !step.done)?.id ?? 'review');
    const writable = canWrite(
      location.business.organization.status,
      location.business.organization.trialEndsAt,
      new Date(),
    );
    return {
      vertical: 'BEAUTY' as const,
      businessId: location.businessId,
      locationId: location.id,
      flowVersion: 2,
      storedFlowVersion: saved?.flowVersion ?? null,
      currentStep,
      draft,
      // страна организации из регистрации: от неё настройка подставляет пояс и валюту (Q-SCHED-3)
      organizationCountry: location.business.organization.countryCode,
      // язык организации (ORG-LOCALE-20261026): меняет только владелец (`POST /branches/organization/locale`)
      organizationLocale: location.business.organization.locale ?? 'ru',
      canEditLocale: currentRole() === 'OWNER' && writable,
      profileApplied,
      completedFlowVersion,
      readiness,
      completedAt: saved?.completedAt?.toISOString() ?? null,
      updatedAt: saved?.updatedAt.toISOString() ?? null,
      canEdit: actorMay('settings') && writable,
      permissions: {
        profile: actorMay('settings') && writable,
        complete: actorMay('settings') && writable,
        services: actorMay('rates') && writable,
        masters: actorMay('property') && writable,
        skills: actorMay('property') && writable,
        schedule: actorMay('property') && writable,
      },
    };
  }
  private async saveBeauty(body: Record<string, unknown>) {
    return this.prisma.db.$transaction(
      async (tx) => {
        // Same order as every Beauty mutation. The business lock covers catalogue and all child writes.
        await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${currentOrganizationId()}::uuid FOR SHARE`;
        await tx.$queryRaw`SELECT id FROM businesses WHERE id = ${currentBusinessId()}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM locations WHERE id = ${currentLocationId()}::uuid FOR UPDATE`;
        const location = await this.context(tx);
        if (location.business.vertical !== 'BEAUTY' || !actorMay('settings'))
          throw new ForbiddenException('Настройка недоступна');
        if (
          !canWrite(
            location.business.organization.status,
            location.business.organization.trialEndsAt,
            new Date(),
          )
        )
          throw new ForbiddenException('Организация доступна только для чтения');
        const state = await this.beautyStatus(tx);
        if (state.updatedAt !== (body.updatedAt ?? null))
          throw new ConflictException(
            'Настройка изменена в другом окне. Сравните данные перед сохранением.',
          );
        const saved = await tx.onboardingProgress.findUnique({
          where: { locationId: location.id },
        });
        const values = sharedDraft(body.draft);
        let profileApplied = state.profileApplied;
        let completedFlowVersion = state.completedFlowVersion;
        let currentStep = state.currentStep;
        if (body.action === 'complete') {
          if (!state.readiness.ready)
            throw new ConflictException(
              'Салон ещё не готов. Завершите связанные услуги, мастера и график.',
            );
          if (state.completedFlowVersion === 2) return state;
          completedFlowVersion = 2;
          currentStep = 'review';
          await tx.auditLog.create({
            data: {
              organizationId: currentOrganizationId(),
              userId: currentUserId(),
              entityType: 'Location',
              entityId: location.id,
              action: 'onboarding.beauty.complete',
              after: { flowVersion: 2, chain: state.readiness.chain },
            },
          });
        } else if (body.action === 'apply-profile') {
          validateShared(values);
          if (values.currency !== location.currency || values.timezone !== location.timezone) {
            const used = await tx.location.findUnique({
              where: { id: location.id },
              select: {
                property: { select: { id: true } },
                _count: {
                  select: {
                    services: true,
                    appointments: true,
                    workingHours: true,
                    employees: true,
                    // проведённые документы бара в старой валюте (ADR-186): без курса пересчёт невозможен
                    barStockMovements: true,
                    // деньги ресторана и кассы филиала в старой валюте (ADR-187): пересчёт без курса невозможен
                    restaurantPayments: true,
                    restaurantCashOps: true,
                  },
                },
              },
            });
            if (used?.property || Object.values(used?._count ?? {}).some((n) => n > 0))
              throw new ConflictException(
                'В филиале уже есть рабочие данные. Валюта и часовой пояс не изменены.',
              );
          }
          if (values.businessName !== location.business.name)
            await tx.business.update({
              where: { id: location.businessId },
              data: { name: values.businessName },
            });
          const contacts = {
            ...(values.address !== undefined ? { address: values.address || null } : {}),
            ...(values.phone !== undefined ? { phone: values.phone || null } : {}),
          };
          if (
            values.locationName !== location.name ||
            values.currency !== location.currency ||
            values.timezone !== location.timezone ||
            Object.keys(contacts).length > 0
          )
            await tx.location.update({
              where: { id: location.id },
              data: {
                name: values.locationName,
                currency: values.currency,
                timezone: values.timezone,
                ...contacts,
              },
            });
          await tx.auditLog.create({
            data: {
              organizationId: currentOrganizationId(),
              userId: currentUserId(),
              entityType: 'Location',
              entityId: location.id,
              action: 'onboarding.beauty.profile',
              after: { ...values, flowVersion: 2 },
            },
          });
          profileApplied = true;
          currentStep = 'services';
        } else if (body.action === 'next' && currentStep === 'welcome') currentStep = 'profile';
        else if (body.action === 'back' && !profileApplied) currentStep = 'welcome';
        const metadata = {
          profileApplied,
          ...(completedFlowVersion ? { completedFlowVersion } : {}),
        };
        const data = {
          flowVersion: 2,
          currentStep,
          draft: { ...values, ...metadata },
          updatedAt: new Date(Math.max(Date.now(), (saved?.updatedAt.getTime() ?? 0) + 1)),
          completedAt: saved?.completedAt ?? (body.action === 'complete' ? new Date() : null),
        };
        await tx.onboardingProgress.upsert({
          where: { locationId: location.id },
          create: { locationId: location.id, ...data },
          update: data,
        });
        return this.beautyStatus(tx);
      },
      { maxWait: 5000, timeout: 10000 },
    );
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
