import type { BusinessVertical } from '@pms/domain';
import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';

/**
 * Business Agent: хранилище создания и чтения черновиков (SA2, plans/business-ai-seller-sa2-2026-09-30.md, DATA_MODEL §20).
 * Организацию называет вызывающий из вошедшего, не из тела запроса. Схему держит SA1.6: здесь только запросы.
 */

export const BUSINESS_AGENTS = Symbol('BUSINESS_AGENTS');

export interface AgentPlacementRow {
  business: { id: string; name: string; vertical?: BusinessVertical };
  location: { id: string; name: string };
}

export interface BusinessOptionLocation {
  id: string;
  name: string;
  /** На филиале уже есть неархивный AI-продавец (частичный уникальный индекс SA1.6) */
  taken: boolean;
}

export interface BusinessOption {
  id: string;
  name: string;
  locations: BusinessOptionLocation[];
}

export interface BusinessAgentRecord extends AgentPlacementRow {
  id: string;
  name: string;
  lifecycle: string;
  createdAt: Date;
  updatedAt: Date;
}

/** На этом филиале уже есть неархивный AI-продавец */
export class LocationTakenError extends Error {}
/** Ключ идемпотентности принадлежит чужой записи (другой организации, другому человеку или рабочему продавцу) */
export class ForeignIdempotencyKeyError extends Error {}

export interface BusinessAgentsRepository {
  /** Действующие Business организации и их действующие филиалы с отметкой «занят» */
  options(organizationId: string): Promise<BusinessOption[]>;
  /** Филиал принадлежит Business, а Business, организации; оба действующие. `null`, иначе */
  placement(organizationId: string, businessId: string, locationId: string): Promise<AgentPlacementRow | null>;
  /**
   * Черновик по ключу идемпотентности: ключ становится идентификатором агента (приём гостевого мастера), запись идёт под
   * замком на ключ. Повтор возвращает того же агента с `created: false`, журнал не дописывается.
   */
  create(input: {
    id: string;
    organizationId: string;
    userId: string;
    name: string;
    businessId: string;
    locationId: string;
  }): Promise<{ agent: BusinessAgentRecord; created: boolean }>;
  /** Агент организации с филиалом. Рабочий продавец (`id = organization_id`) и записи мастера без филиала сюда не попадают */
  get(organizationId: string, id: string): Promise<BusinessAgentRecord | null>;
}

const agentSelect = {
  id: true,
  name: true,
  lifecycle: true,
  createdAt: true,
  updatedAt: true,
  organizationId: true,
  createdBy: true,
  location: { select: { id: true, name: true, business: { select: { id: true, name: true, vertical: true } } } },
} as const;

type AgentRow = {
  id: string;
  name: string;
  lifecycle: string;
  createdAt: Date;
  updatedAt: Date;
  location: { id: string; name: string; business: { id: string; name: string; vertical?: BusinessVertical } } | null;
};

function record(row: AgentRow): BusinessAgentRecord | null {
  if (!row.location) return null;
  return {
    id: row.id,
    name: row.name,
    lifecycle: row.lifecycle,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    business: { id: row.location.business.id, name: row.location.business.name, ...(row.location.business.vertical ? { vertical: row.location.business.vertical } : {}) },
    location: { id: row.location.id, name: row.location.name },
  };
}

function isLocationTaken(error: unknown): boolean {
  const text = `${(error as { message?: string })?.message ?? ''} ${JSON.stringify((error as { meta?: unknown })?.meta ?? '')}`;
  return /seller_agents_one_seller_per_location/.test(text);
}

@Injectable()
export class PrismaBusinessAgentsRepository implements BusinessAgentsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async options(organizationId: string): Promise<BusinessOption[]> {
    const rows = await this.prisma.db.business.findMany({
      where: { organizationId, status: 'ACTIVE' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        locations: {
          where: { status: 'ACTIVE' },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            name: true,
            sellerAgents: {
              where: { scenario: 'sales', lifecycle: { not: 'archived' } },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });
    return rows.map((b) => ({
      id: b.id,
      name: b.name,
      locations: b.locations.map((l) => ({ id: l.id, name: l.name, taken: l.sellerAgents.length > 0 })),
    }));
  }

  async placement(organizationId: string, businessId: string, locationId: string): Promise<AgentPlacementRow | null> {
    const location = await this.prisma.db.location.findFirst({
      where: { id: locationId, businessId, status: 'ACTIVE', business: { id: businessId, organizationId, status: 'ACTIVE' } },
      select: { id: true, name: true, business: { select: { id: true, name: true, vertical: true } } },
    });
    if (!location) return null;
    return { business: { id: location.business.id, name: location.business.name, vertical: location.business.vertical }, location: { id: location.id, name: location.name } };
  }

  async create(input: {
    id: string;
    organizationId: string;
    userId: string;
    name: string;
    businessId: string;
    locationId: string;
  }): Promise<{ agent: BusinessAgentRecord; created: boolean }> {
    let result: { row: AgentRow; created: boolean };
    try {
      result = await this.prisma.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${input.id}))::text`;
        const existing = await tx.sellerAgent.findUnique({ where: { id: input.id }, select: agentSelect });
        if (existing) {
          // ключ чужой записи, а также ключ, равный организации, это рабочий продавец, а не результат этого создания
          if (
            existing.organizationId !== input.organizationId ||
            existing.createdBy !== input.userId ||
            existing.id === input.organizationId
          )
            throw new ForeignIdempotencyKeyError();
          return { row: existing, created: false };
        }
        const row = await tx.sellerAgent.create({
          data: {
            id: input.id,
            organizationId: input.organizationId,
            createdBy: input.userId,
            name: input.name,
            scenario: 'sales',
            lifecycle: 'draft',
            locationId: input.locationId,
          },
          select: agentSelect,
        });
        await tx.auditLog.create({
          data: {
            userId: input.userId,
            organizationId: input.organizationId,
            entityType: 'seller-agent',
            entityId: input.id,
            action: 'agent.created',
            // название в журнал не идёт: только где и в каком состоянии создан агент
            after: { source: 'business-agent', businessId: input.businessId, locationId: input.locationId, lifecycle: 'draft' },
          },
        });
        return { row, created: true };
      });
    } catch (error) {
      if (isLocationTaken(error)) throw new LocationTakenError();
      throw error;
    }
    const agent = record(result.row);
    if (!agent) throw new ForeignIdempotencyKeyError();
    return { agent, created: result.created };
  }

  async get(organizationId: string, id: string): Promise<BusinessAgentRecord | null> {
    if (id === organizationId) return null;
    const row = await this.prisma.db.sellerAgent.findFirst({ where: { id, organizationId }, select: agentSelect });
    return row ? record(row) : null;
  }
}
