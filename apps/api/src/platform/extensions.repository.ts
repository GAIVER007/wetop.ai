import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import type { ExtensionChange, ExtensionStatus, OrganizationStatus } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';

/** Расширение «ИИ-продавец» организации как оно лежит в базе (DATA_MODEL §16.3) */
export interface ExtensionRow {
  status: ExtensionStatus;
  activeUntil: Date | null;
  note: string | null;
  updatedAt: Date;
}

/**
 * Организация глазами главного администратора (ADR-083): название, статус и сроки, сколько людей, почты владельцев —
 * для счёта — и расширение. Броней, гостей, счетов и переписки здесь нет по построению.
 */
export interface OrganizationSummary {
  id: string;
  name: string;
  status: OrganizationStatus;
  trialEndsAt: Date | null;
  createdAt: Date;
  members: number;
  owners: string[];
  aiSeller: ExtensionRow | null;
}

export interface ExtensionsRepository {
  aiSeller(organizationId: string): Promise<ExtensionRow | null>;
  /** Название организации (ORG1, ADR-154): изменение и строка журнала одной транзакцией */
  rename(input: { organizationId: string; name: string; by: string | null; now: Date }): Promise<void>;
  /**
   * Архив вместо удаления (ORG1, ADR-154): статус `SUSPENDED`, люди организации не входят, данные целы. Прежний статус
   * остаётся в журнале (`before`): по нему идёт возврат. Статус и строка журнала — одной транзакцией.
   */
  archive(input: { organizationId: string; by: string | null; now: Date }): Promise<void>;
  /**
   * Возврат из архива: статус, который был до него (последняя запись `organization.archived`). Не нашли или он снова
   * `SUSPENDED` — «только чтение»: платный доступ сам не появляется, его ставит «Оплата получена».
   */
  restore(input: { organizationId: string; by: string | null; now: Date }): Promise<void>;
  organizations(): Promise<OrganizationSummary[]>;
  organization(id: string): Promise<OrganizationSummary | null>;
  /** Изменение и строка журнала — одной транзакцией: без записи в журнале расширение не меняется */
  saveAiSeller(input: {
    organizationId: string;
    change: ExtensionChange;
    by: string | null;
    now: Date;
  }): Promise<void>;
  /**
   * Оплата счётом (Q-141 — А, ADR-102): главный администратор ставит `ACTIVE` («оплата подтверждена») или обратно
   * `READ_ONLY`. Статус и строка журнала — одной транзакцией.
   */
  saveStatus(input: {
    organizationId: string;
    status: 'ACTIVE' | 'READ_ONLY';
    note: string | null;
    by: string | null;
    now: Date;
  }): Promise<void>;
}

export const EXTENSIONS_REPOSITORY = Symbol('EXTENSIONS_REPOSITORY');

const KIND = 'AI_SELLER' as const;

const trace = (row: Pick<ExtensionRow, 'status' | 'activeUntil' | 'note'>) => ({
  extension: KIND,
  status: row.status,
  activeUntil: row.activeUntil?.toISOString() ?? null,
  note: row.note,
});

@Injectable()
export class PrismaExtensionsRepository implements ExtensionsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async saveStatus(input: {
    organizationId: string;
    status: 'ACTIVE' | 'READ_ONLY';
    note: string | null;
    by: string | null;
    now: Date;
  }): Promise<void> {
    await this.prisma.db.$transaction(async (tx) => {
      const before = await tx.organization.findUnique({
        where: { id: input.organizationId },
        select: { status: true },
      });
      await tx.organization.update({ where: { id: input.organizationId }, data: { status: input.status } });
      await tx.auditLog.create({
        data: {
          userId: input.by,
          entityType: 'organization',
          entityId: input.organizationId,
          action: 'organization.status_changed',
          ...(before ? { before: { status: before.status } } : {}),
          after: { status: input.status, note: input.note },
        },
      });
    });
  }

  async rename(input: { organizationId: string; name: string; by: string | null; now: Date }): Promise<void> {
    await this.prisma.db.$transaction(async (tx) => {
      const before = await tx.organization.findUnique({
        where: { id: input.organizationId },
        select: { name: true },
      });
      await tx.organization.update({ where: { id: input.organizationId }, data: { name: input.name } });
      await tx.auditLog.create({
        data: {
          userId: input.by,
          entityType: 'organization',
          entityId: input.organizationId,
          action: 'organization.renamed',
          ...(before ? { before: { name: before.name } } : {}),
          after: { name: input.name },
        },
      });
    });
  }

  async archive(input: { organizationId: string; by: string | null; now: Date }): Promise<void> {
    await this.prisma.db.$transaction(async (tx) => {
      const before = await tx.organization.findUnique({
        where: { id: input.organizationId },
        select: { status: true },
      });
      await tx.organization.update({ where: { id: input.organizationId }, data: { status: 'SUSPENDED' } });
      await tx.auditLog.create({
        data: {
          userId: input.by,
          entityType: 'organization',
          entityId: input.organizationId,
          action: 'organization.archived',
          ...(before ? { before: { status: before.status } } : {}),
          after: { status: 'SUSPENDED' },
        },
      });
    });
  }

  async restore(input: { organizationId: string; by: string | null; now: Date }): Promise<void> {
    await this.prisma.db.$transaction(async (tx) => {
      const archived = await tx.auditLog.findFirst({
        where: { entityType: 'organization', entityId: input.organizationId, action: 'organization.archived' },
        orderBy: { createdAt: 'desc' },
        select: { before: true },
      });
      const was = (archived?.before as { status?: unknown } | null)?.status;
      const status: OrganizationStatus =
        was === 'TRIAL' || was === 'ACTIVE' || was === 'READ_ONLY' ? was : 'READ_ONLY';
      await tx.organization.update({ where: { id: input.organizationId }, data: { status } });
      await tx.auditLog.create({
        data: {
          userId: input.by,
          entityType: 'organization',
          entityId: input.organizationId,
          action: 'organization.restored',
          before: { status: 'SUSPENDED' },
          after: { status },
        },
      });
    });
  }

  async aiSeller(organizationId: string): Promise<ExtensionRow | null> {
    return this.prisma.db.organizationExtension.findUnique({
      where: { organizationId_extension: { organizationId, extension: KIND } },
      select: { status: true, activeUntil: true, note: true, updatedAt: true },
    });
  }

  async organizations(): Promise<OrganizationSummary[]> {
    const rows = await this.prisma.db.organization.findMany({
      orderBy: { createdAt: 'asc' },
      select: SUMMARY,
    });
    return rows.map(summary);
  }

  async organization(id: string): Promise<OrganizationSummary | null> {
    const row = await this.prisma.db.organization.findUnique({ where: { id }, select: SUMMARY });
    return row ? summary(row) : null;
  }

  async saveAiSeller(input: {
    organizationId: string;
    change: ExtensionChange;
    by: string | null;
    now: Date;
  }): Promise<void> {
    const key = { organizationId: input.organizationId, extension: KIND };
    await this.prisma.db.$transaction(async (tx) => {
      const before = await tx.organizationExtension.findUnique({
        where: { organizationId_extension: key },
        select: { status: true, activeUntil: true, note: true, updatedAt: true },
      });
      const data = { ...input.change, updatedAt: input.now, updatedBy: input.by };
      await tx.organizationExtension.upsert({
        where: { organizationId_extension: key },
        create: { ...key, ...data },
        update: data,
      });
      await tx.auditLog.create({
        data: {
          userId: input.by,
          entityType: 'organization',
          entityId: input.organizationId,
          action: 'extension.updated',
          // строки не было — «было» в журнале пусто, а не выдуманное «выключен»
          ...(before ? { before: trace(before) } : {}),
          after: trace(input.change),
        },
      });
    });
  }
}

const SUMMARY = {
  id: true,
  name: true,
  status: true,
  trialEndsAt: true,
  createdAt: true,
  _count: { select: { memberships: true } },
  memberships: {
    where: { role: 'OWNER' as const },
    orderBy: { createdAt: 'asc' as const },
    select: { user: { select: { email: true } } },
  },
  extensions: {
    where: { extension: KIND },
    select: { status: true, activeUntil: true, note: true, updatedAt: true },
  },
};

function summary(row: {
  id: string;
  name: string;
  status: OrganizationStatus;
  trialEndsAt: Date | null;
  createdAt: Date;
  _count: { memberships: number };
  memberships: Array<{ user: { email: string } }>;
  extensions: ExtensionRow[];
}): OrganizationSummary {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    trialEndsAt: row.trialEndsAt,
    createdAt: row.createdAt,
    members: row._count.memberships,
    owners: row.memberships.map((m) => m.user.email),
    aiSeller: row.extensions[0] ?? null,
  };
}
