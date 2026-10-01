import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NEW_PROPERTY_DEFAULTS } from '@pms/database';
import {
  LUXX_APARTS_PROPERTY,
  parseBranchInput,
  summarizeBranches,
  type BranchPeriod,
  type BranchesTotal,
  type DashboardFund,
  type DashboardPeriod,
} from '@pms/domain';
import {
  actorIsOwner,
  currentLocationId,
  currentOrganizationId,
  hasSignedInActor,
  scopeView,
  withScopeOf,
} from '../auth/request-context';
import { DashboardService } from '../dashboard/dashboard.service';
import { PrismaService } from '../database/prisma.provider';
import { FOREIGN_PROPERTY_MESSAGE, propertyRef } from '../database/property-ref';
import {
  ORGANIZATION_REPOSITORY,
  type BranchRow,
  type OrganizationRepository,
  type OrganizationStructure,
} from './organization.repository';

export const BRANCH_OWNER_ONLY_MESSAGE = 'Филиал добавляет владелец организации';
export const BRANCH_NAMESAKE_MESSAGE = 'Филиал с таким названием уже есть';
export const ORGANIZATION_NOT_FOUND_MESSAGE = 'Организация не найдена';

export interface BranchView {
  id: string;
  businessId: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  timezone: string;
  currency: string;
  createdAt: string;
  propertyId: string | null;
  propertyName: string | null;
}

/** Текущий филиал — тот, чей объект отвечает на запросы стойки сейчас (по указателю, иначе самый ранний) */
export interface WorkspaceView {
  business: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
  /** Из чего выбирать: все действующие филиалы всех бизнесов, в порядке создания */
  options: Array<{ businessId: string; businessName: string; locationId: string; locationName: string }>;
}

export interface OrganizationView {
  id: string;
  name: string;
  reportingCurrency: string;
  businesses: Array<{ id: string; name: string; vertical: string; locations: BranchView[] }>;
  current: WorkspaceView;
  canAddBranch: { ok: true } | { ok: false; reason: string };
  /** Умолчания формы нового филиала — часовой пояс и валюта первого филиала (у организации без филиалов — регистрации) */
  branchDefaults: { timezone: string; currency: string };
}

export interface BranchSummaryRow {
  locationId: string;
  businessId: string;
  businessName: string;
  name: string;
  currency: string;
  propertyName: string | null;
  /** Текущий филиал стойки — строку можно подсветить */
  current: boolean;
  period: DashboardPeriod | null;
}

export interface BranchesSummaryView {
  from: string;
  to: string;
  fund: DashboardFund;
  reportingCurrency: string;
  branches: BranchSummaryRow[];
  total: BranchesTotal;
}

const branchView = (row: BranchRow): BranchView => ({
  id: row.id,
  businessId: row.businessId,
  name: row.name,
  address: row.address,
  phone: row.phone,
  email: row.email,
  timezone: row.timezone,
  currency: row.currency,
  createdAt: row.createdAt.toISOString(),
  propertyId: row.property?.id ?? null,
  propertyName: row.property?.name ?? null,
});

/**
 * Филиалы организации (Platform P3, ADR-130; план `plans/platform-p3-branches-2026-10-01.md`). Структуру читает каждый
 * вошедший — переключатель нужен и администратору; добавляет филиал владелец (Q-236); сводку видит право `reports`
 * (маршрут). Служебным ходокам здесь нечего делать: филиалы — выбор человека.
 */
@Injectable()
export class OrganizationService {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY) private readonly repo: OrganizationRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DashboardService) private readonly dashboard: DashboardService,
  ) {}

  private organizationId(): string {
    const organizationId = hasSignedInActor() ? currentOrganizationId() : null;
    if (organizationId === null) throw new ForbiddenException(FOREIGN_PROPERTY_MESSAGE);
    return organizationId;
  }

  private async structureOrThrow(): Promise<OrganizationStructure> {
    const structure = await this.repo.structure(this.organizationId());
    if (!structure) throw new NotFoundException(ORGANIZATION_NOT_FOUND_MESSAGE);
    return structure;
  }

  private branchDefaults(structure: OrganizationStructure): { timezone: string; currency: string } {
    const first = this.branches(structure)[0]?.location;
    return {
      timezone: first?.timezone ?? NEW_PROPERTY_DEFAULTS.timezone,
      currency: first?.currency ?? NEW_PROPERTY_DEFAULTS.currency,
    };
  }

  /** Все действующие филиалы с их бизнесом — в порядке создания бизнесов и филиалов */
  private branches(structure: OrganizationStructure) {
    return structure.businesses.flatMap((b) => b.locations.map((l) => ({ business: b, location: l })));
  }

  /**
   * Какой филиал обслуживает запросы стойки сейчас: по проверенному указателю, иначе — филиал самого раннего объекта
   * (то же правило, что `property-ref.ts` при scope ORGANIZATION). У организации без объекта — ничего.
   */
  private async currentOf(structure: OrganizationStructure): Promise<WorkspaceView> {
    const all = this.branches(structure);
    const options = all.map(({ business, location }) => ({
      businessId: business.id,
      businessName: business.name,
      locationId: location.id,
      locationName: location.name,
    }));
    const chosen = currentLocationId();
    let hit = chosen ? all.find(({ location }) => location.id === chosen) : undefined;
    if (!hit) {
      const propertyId = await propertyRef(this.prisma.db, LUXX_APARTS_PROPERTY.name)
        .then((p) => p.id)
        .catch(() => null);
      hit = propertyId ? all.find(({ location }) => location.property?.id === propertyId) : undefined;
    }
    return {
      business: hit ? { id: hit.business.id, name: hit.business.name } : null,
      location: hit ? { id: hit.location.id, name: hit.location.name } : null,
      options,
    };
  }

  /** Для `GET /auth/me`: подпись и варианты переключателя. Любой сбой — пустая область, вход от этого не ломается */
  async workspace(): Promise<WorkspaceView> {
    const empty: WorkspaceView = { business: null, location: null, options: [] };
    try {
      const structure = await this.repo.structure(this.organizationId());
      return structure ? await this.currentOf(structure) : empty;
    } catch {
      return empty;
    }
  }

  async structure(): Promise<OrganizationView> {
    const structure = await this.structureOrThrow();
    return {
      id: structure.id,
      name: structure.name,
      reportingCurrency: structure.reportingCurrency,
      businesses: structure.businesses.map((b) => ({
        id: b.id,
        name: b.name,
        vertical: b.vertical,
        locations: b.locations.map(branchView),
      })),
      current: await this.currentOf(structure),
      canAddBranch: actorIsOwner() ? { ok: true } : { ok: false, reason: BRANCH_OWNER_ONLY_MESSAGE },
      branchDefaults: this.branchDefaults(structure),
    };
  }

  /** Новый филиал: умолчания часового пояса и валюты — у первого филиала организации; тёзка — 409 */
  async createBranch(raw: unknown): Promise<BranchView> {
    const organizationId = this.organizationId();
    if (!actorIsOwner()) throw new ForbiddenException(BRANCH_OWNER_ONLY_MESSAGE);
    const structure = await this.structureOrThrow();
    const parsed = parseBranchInput(raw, this.branchDefaults(structure));
    if (!parsed.ok) throw new BadRequestException({ message: parsed.reason, field: parsed.field ?? null });
    if (await this.repo.namesake(organizationId, parsed.value.name))
      throw new ConflictException({ message: BRANCH_NAMESAKE_MESSAGE, field: 'name' });
    return branchView(await this.repo.createBranch(organizationId, parsed.value));
  }

  /**
   * Сводка по филиалам за период: те же показатели, что «Аналитика → Обзор», в scope каждого филиала по очереди (пул
   * API — 5 соединений, а шахматка сама ходит в базу несколькими запросами), и итог по правилу домена.
   */
  async summary(from?: string, to?: string, fund: string = 'all'): Promise<BranchesSummaryView> {
    const period = this.dashboard.checkPeriod(from, to, fund);
    const structure = await this.structureOrThrow();
    const current = await this.currentOf(structure);
    const branches: BranchSummaryRow[] = [];
    for (const { business, location } of this.branches(structure)) {
      const metrics = location.property
        ? await withScopeOf(
            { scope: 'LOCATION', businessId: business.id, locationId: location.id, vertical: business.vertical },
            () => this.dashboard.period(period.from, period.to, period.fund),
          )
        : null;
      branches.push({
        locationId: location.id,
        businessId: business.id,
        businessName: business.name,
        name: location.name,
        currency: location.currency,
        propertyName: location.property?.name ?? null,
        current: current.location?.id === location.id,
        period: metrics,
      });
    }
    const rows: BranchPeriod[] = branches.map((b) => ({
      locationId: b.locationId,
      currency: b.currency,
      period: b.period,
    }));
    return {
      from: period.from,
      to: period.to,
      fund: period.fund,
      reportingCurrency: structure.reportingCurrency,
      branches,
      total: summarizeBranches(rows),
    };
  }

  /** Scope текущего запроса — для ответа стойке вместе с подписью */
  scope() {
    return scopeView();
  }
}
