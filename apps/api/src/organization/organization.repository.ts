import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import { NEW_PROPERTY_DEFAULTS, createPropertyInChain } from '@pms/database';
import type { BranchInput } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';

/**
 * Структура организации вошедшего (Platform P3, ADR-130; DATA_MODEL §18): бизнесы и их филиалы с объектами.
 * Только действующие строки, архивный филиал не выбирается указателем (`auth/scope.ts`), поэтому и в списке его нет.
 */
export interface BranchRow {
  id: string;
  businessId: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  timezone: string;
  currency: string;
  createdAt: Date;
  /** Объект филиала; `null`, филиал без объекта (у Hospitality так не бывает, но модель это допускает) */
  property: { id: string; name: string } | null;
}

export interface BusinessRow {
  id: string;
  name: string;
  vertical: 'HOSPITALITY' | 'BEAUTY';
  locations: BranchRow[];
}

export interface OrganizationStructure {
  id: string;
  name: string;
  reportingCurrency: string;
  businesses: BusinessRow[];
}

export interface OrganizationRepository {
  structure(organizationId: string): Promise<OrganizationStructure | null>;
  /** Есть ли уже филиал с таким названием (без учёта регистра), тёзки переключатель не различит */
  namesake(organizationId: string, name: string): Promise<boolean>;
  /**
   * Новый филиал, сразу в цепочке Business → Location → Property одной транзакцией (`createPropertyInChain`:
   * ранний Business HOSPITALITY организации или новый с её именем). Журнал, той же транзакцией.
   */
  createBranch(organizationId: string, input: BranchInput): Promise<BranchRow>;
}

export const ORGANIZATION_REPOSITORY = Symbol('ORGANIZATION_REPOSITORY');

const ORDER = [{ createdAt: 'asc' as const }, { id: 'asc' as const }];
const BRANCH = {
  id: true,
  businessId: true,
  name: true,
  address: true,
  phone: true,
  email: true,
  timezone: true,
  currency: true,
  createdAt: true,
  property: { select: { id: true, name: true } },
};

@Injectable()
export class PrismaOrganizationRepository implements OrganizationRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async structure(organizationId: string): Promise<OrganizationStructure | null> {
    const row = await this.prisma.db.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        reportingCurrency: true,
        businesses: {
          where: { status: 'ACTIVE' },
          orderBy: ORDER,
          select: {
            id: true,
            name: true,
            vertical: true,
            locations: { where: { status: 'ACTIVE' }, orderBy: ORDER, select: BRANCH },
          },
        },
      },
    });
    return row;
  }

  async namesake(organizationId: string, name: string): Promise<boolean> {
    const found = await this.prisma.db.location.findFirst({
      where: { business: { organizationId }, name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    return found !== null;
  }

  async createBranch(organizationId: string, input: BranchInput): Promise<BranchRow> {
    return this.prisma.db.$transaction(async (tx) => {
      const property = await createPropertyInChain(tx, organizationId, {
        name: input.name,
        address: input.address,
        phone: input.phone,
        email: input.email,
        timezone: input.timezone,
        currency: input.currency,
        checkInTime: NEW_PROPERTY_DEFAULTS.checkInTime,
        checkOutTime: NEW_PROPERTY_DEFAULTS.checkOutTime,
      });
      const location = await tx.location.findUniqueOrThrow({
        where: { id: property.locationId },
        select: BRANCH,
      });
      await tx.auditLog.create({
        data: {
          entityType: 'Location',
          entityId: location.id,
          action: 'organization.location.created',
          after: {
            name: location.name,
            businessId: location.businessId,
            propertyId: property.id,
            timezone: location.timezone,
            currency: location.currency,
          },
        },
      });
      return location;
    });
  }
}
