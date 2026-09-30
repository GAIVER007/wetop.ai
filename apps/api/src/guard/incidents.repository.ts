import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import {
  POLICY,
  redactDetails,
  redactText,
  type IncidentClass,
  type IncidentKind,
  type IncidentSeverity,
  type IncidentStatus,
  type Observation,
} from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { integrationTables, onIntegrationTables } from '../database/integration-tables';

export const INCIDENTS_REPOSITORY = Symbol('INCIDENTS_REPOSITORY');

export type ResolvedBy = 'GUARD' | 'AGENT' | 'STAFF';

export interface IncidentRow {
  id: string;
  kind: IncidentKind;
  class: IncidentClass;
  severity: IncidentSeverity;
  fingerprint: string;
  status: IncidentStatus;
  title: string;
  subjectType: string | null;
  subjectId: string | null;
  details: unknown;
  occurrences: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  fixAttempts: number;
  lastFixAt: Date | null;
  lastFixResult: string | null;
  alertedAt: Date | null;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  resolvedBy: ResolvedBy | null;
}

/** Одно место для неисправностей (DATA_MODEL §12). Всё, что пишется, проходит маскирование домена. */
export interface IncidentsRepository {
  /** Все незакрытые */
  open(): Promise<IncidentRow[]>;
  /** Новая строка или повтор открытой с тем же отпечатком (+1 к occurrences) */
  record(o: Observation & { fingerprint: string }, now: Date): Promise<IncidentRow>;
  resolve(ids: string[], by: ResolvedBy, now: Date): Promise<number>;
  /** Сторож попробовал починить: +1 попытка, итог одной строкой, статус FIXING */
  markFixAttempt(id: string, result: string, now: Date): Promise<void>;
  /** К человеку или агенту: ESCALATED (принятую человеком не трогает) */
  escalate(id: string, reason: string | null): Promise<void>;
  markAlerted(ids: string[], now: Date): Promise<void>;
  acknowledge(id: string, now: Date): Promise<IncidentRow | null>;
  get(id: string): Promise<IncidentRow | null>;
  list(opts: { status: 'open' | 'all'; limit: number }): Promise<IncidentRow[]>;
  /** Хранение — 90 дней после закрытия */
  purgeResolvedBefore(date: Date): Promise<number>;
}

type Raw = {
  id: string;
  kind: string;
  class: IncidentClass;
  severity: IncidentSeverity;
  fingerprint: string;
  status: IncidentStatus;
  title: string;
  subject_type: string | null;
  subject_id: string | null;
  details: unknown;
  occurrences: number;
  first_seen_at: Date;
  last_seen_at: Date;
  fix_attempts: number;
  last_fix_at: Date | null;
  last_fix_result: string | null;
  alerted_at: Date | null;
  acknowledged_at: Date | null;
  resolved_at: Date | null;
  resolved_by: ResolvedBy | null;
};

function fromRaw(r: Raw): IncidentRow {
  return {
    id: r.id,
    kind: r.kind as IncidentKind,
    class: r.class,
    severity: r.severity,
    fingerprint: r.fingerprint,
    status: r.status,
    title: r.title,
    subjectType: r.subject_type,
    subjectId: r.subject_id,
    details: r.details,
    occurrences: r.occurrences,
    firstSeenAt: r.first_seen_at,
    lastSeenAt: r.last_seen_at,
    fixAttempts: r.fix_attempts,
    lastFixAt: r.last_fix_at,
    lastFixResult: r.last_fix_result,
    alertedAt: r.alerted_at,
    acknowledgedAt: r.acknowledged_at,
    resolvedAt: r.resolved_at,
    resolvedBy: r.resolved_by,
  };
}

type PrismaRow = Parameters<typeof fromPrisma>[0];
function fromPrisma(r: {
  id: string;
  kind: string;
  class: IncidentClass;
  severity: IncidentSeverity;
  fingerprint: string;
  status: IncidentStatus;
  title: string;
  subjectType: string | null;
  subjectId: string | null;
  details: unknown;
  occurrences: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  fixAttempts: number;
  lastFixAt: Date | null;
  lastFixResult: string | null;
  alertedAt: Date | null;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  resolvedBy: ResolvedBy | null;
}): IncidentRow {
  return { ...r, kind: r.kind as IncidentKind };
}

@Injectable()
export class PrismaIncidentsRepository implements IncidentsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async open(): Promise<IncidentRow[]> {
    const rows = await integrationTables(this.prisma.db).systemIncident.findMany({
      where: { status: { not: 'RESOLVED' } },
      orderBy: [{ severity: 'asc' }, { firstSeenAt: 'asc' }],
    });
    return rows.map((r: PrismaRow) => fromPrisma(r));
  }

  /**
   * INSERT … ON CONFLICT по частичному уникальному индексу (fingerprint WHERE status <> 'RESOLVED'): Prisma
   * upsert такой индекс не видит, поэтому сырой SQL. Гонка двух процессов на одном отпечатке решается базой.
   * Важность при повторе обновляется (овербукинг «завтра» стал «сегодня»), класс — нет: он из политики вида.
   */
  async record(o: Observation & { fingerprint: string }, now: Date): Promise<IncidentRow> {
    const p = POLICY[o.kind];
    const severity = o.severity ?? p.severity;
    const details = o.details === undefined ? null : JSON.stringify(redactDetails(o.details));
    const rows = await onIntegrationTables(
      () => this.prisma.db.$queryRaw<Raw[]>`
      INSERT INTO "system_incidents"
        ("id", "kind", "class", "severity", "fingerprint", "title", "subject_type", "subject_id", "details",
         "first_seen_at", "last_seen_at")
      VALUES (gen_random_uuid(), ${o.kind}, ${p.class}::"IncidentClass", ${severity}::"IncidentSeverity",
              ${o.fingerprint}, ${redactText(o.title)}, ${o.subjectType ?? null}, ${o.subjectId ?? null},
              ${details}::jsonb, ${now}, ${now})
      ON CONFLICT ("fingerprint") WHERE "status" <> 'RESOLVED'
      DO UPDATE SET "occurrences" = "system_incidents"."occurrences" + 1,
                    "last_seen_at" = EXCLUDED."last_seen_at",
                    "title" = EXCLUDED."title",
                    "details" = EXCLUDED."details",
                    "severity" = EXCLUDED."severity"
      RETURNING *`,
    );
    return fromRaw(rows[0]!);
  }

  async resolve(ids: string[], by: ResolvedBy, now: Date): Promise<number> {
    if (ids.length === 0) return 0;
    const r = await integrationTables(this.prisma.db).systemIncident.updateMany({
      where: { id: { in: ids }, status: { not: 'RESOLVED' } },
      data: { status: 'RESOLVED', resolvedAt: now, resolvedBy: by },
    });
    return r.count;
  }

  async markFixAttempt(id: string, result: string, now: Date): Promise<void> {
    await integrationTables(this.prisma.db).systemIncident.updateMany({
      where: { id, status: { in: ['OPEN', 'FIXING'] } },
      data: {
        status: 'FIXING',
        fixAttempts: { increment: 1 },
        lastFixAt: now,
        lastFixResult: redactText(result),
      },
    });
  }

  async escalate(id: string, reason: string | null): Promise<void> {
    await integrationTables(this.prisma.db).systemIncident.updateMany({
      where: { id, status: { in: ['OPEN', 'FIXING'] } },
      data: { status: 'ESCALATED', ...(reason ? { lastFixResult: redactText(reason) } : {}) },
    });
  }

  async markAlerted(ids: string[], now: Date): Promise<void> {
    if (ids.length === 0) return;
    await integrationTables(this.prisma.db).systemIncident.updateMany({
      where: { id: { in: ids } },
      data: { alertedAt: now },
    });
  }

  async acknowledge(id: string, now: Date): Promise<IncidentRow | null> {
    await integrationTables(this.prisma.db).systemIncident.updateMany({
      where: { id, status: { not: 'RESOLVED' } },
      data: { status: 'ACKNOWLEDGED', acknowledgedAt: now },
    });
    return this.get(id);
  }

  async get(id: string): Promise<IncidentRow | null> {
    const r = await integrationTables(this.prisma.db).systemIncident.findUnique({ where: { id } });
    return r ? fromPrisma(r) : null;
  }

  async list(opts: { status: 'open' | 'all'; limit: number }): Promise<IncidentRow[]> {
    const rows = await integrationTables(this.prisma.db).systemIncident.findMany({
      where: opts.status === 'open' ? { status: { not: 'RESOLVED' } } : {},
      orderBy: [{ lastSeenAt: 'desc' }],
      take: opts.limit,
    });
    return rows.map((r: PrismaRow) => fromPrisma(r));
  }

  async purgeResolvedBefore(date: Date): Promise<number> {
    const r = await integrationTables(this.prisma.db).systemIncident.deleteMany({
      where: { status: 'RESOLVED', resolvedAt: { lt: date } },
    });
    return r.count;
  }
}
