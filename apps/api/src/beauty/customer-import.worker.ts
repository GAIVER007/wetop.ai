import { randomUUID } from 'node:crypto';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { canWrite, customerPhoneKey, type CustomerImportRowInput } from '@pms/domain';
import { Prisma, type DbTx } from '@pms/database';
import { PrismaService } from '../database/prisma.provider';
import { CUSTOMER_IMPORT_UNDO_TTL_MS } from './customer-import';

const LEASE_MS = 5 * 60 * 1000;
const CONTENTS_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 100;
const customerSelect = {
  id: true,
  organizationId: true,
  firstName: true,
  lastName: true,
  phone: true,
  phoneNormalized: true,
  email: true,
  notes: true,
  status: true,
  isVip: true,
  birthDate: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface CustomerImportClaim {
  id: string;
  organizationId: string;
  businessId: string;
  leaseToken: string;
}
type Job = {
  id: string;
  organizationId: string;
  businessId: string;
  createdBy: string;
  state: string;
  leaseToken: string | null;
  leaseExpiresAt: Date | null;
  processedRows: number;
  totalRows: number;
  createdCount: number;
  linkedCount: number;
  unchangedCount: number;
  skippedCount: number;
  attempts: number;
};
type PendingRow = { id: string; ordinal: number; input: Prisma.JsonValue | null };

function parsedInput(value: Prisma.JsonValue | null): CustomerImportRowInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row['firstName'] !== 'string' ||
    (row['lastName'] !== null && typeof row['lastName'] !== 'string') ||
    (row['phone'] !== null && typeof row['phone'] !== 'string')
  )
    return null;
  return {
    firstName: row['firstName'],
    lastName: row['lastName'] as string | null,
    phone: row['phone'] as string | null,
  };
}
function snapshot(row: Record<string, unknown>): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(row)) as Prisma.InputJsonObject;
}

@Injectable()
export class CustomerImportWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CustomerImportWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private busy = false;
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test' || process.env.CUSTOMER_IMPORT_WORKER?.trim() === 'off')
      return;
    this.timer = setInterval(
      () =>
        void this.tick().catch((error: unknown) =>
          this.logger.warn(`Импорт клиентов: ${(error as Error).name}`),
        ),
      2000,
    );
    this.timer.unref();
  }
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
  async tick(): Promise<string | null> {
    if (this.busy) return null;
    this.busy = true;
    try {
      try {
        await this.purgeExpiredContents();
      } catch (error) {
        this.logger.warn(`Хранение импорта клиентов: ${(error as Error).name}`);
      }
      const claim = await this.claim();
      if (!claim) return null;
      for (let batch = 0; batch < 1000; batch += 1) {
        if (!(await this.process(claim))) break;
      }
      return claim.id;
    } finally {
      this.busy = false;
    }
  }

  async claim(): Promise<CustomerImportClaim | null> {
    const now = new Date(),
      leaseToken = randomUUID(),
      leaseExpiresAt = new Date(now.getTime() + LEASE_MS);
    return this.prisma.db.$transaction(async (tx) => {
      const candidates = await tx.$queryRaw<
        Array<{ id: string; organization_id: string; business_id: string }>
      >`
        SELECT id,organization_id,business_id FROM customer_imports
         WHERE (state='QUEUED' AND next_attempt_at<=${now})
            OR (state='PROCESSING' AND lease_expires_at<=${now})
         ORDER BY next_attempt_at,created_at,id LIMIT 20`;
      for (const candidate of candidates) {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM customer_imports WHERE id=${candidate.id}::uuid
           AND ((state='QUEUED' AND next_attempt_at<=${now}) OR (state='PROCESSING' AND lease_expires_at<=${now}))
           FOR UPDATE SKIP LOCKED`;
        if (!locked.length) continue;
        const updated = await tx.customerImport.updateMany({
          where: { id: candidate.id, state: { in: ['QUEUED', 'PROCESSING'] } },
          data: {
            state: 'PROCESSING',
            leaseToken,
            leaseExpiresAt,
            attempts: { increment: 1 },
            nextAttemptAt: leaseExpiresAt,
          },
        });
        if (updated.count !== 1) continue;
        return {
          id: candidate.id,
          organizationId: candidate.organization_id,
          businessId: candidate.business_id,
          leaseToken,
        };
      }
      return null;
    });
  }

  async process(claim: CustomerImportClaim): Promise<boolean> {
    try {
      return await this.prisma.db.$transaction(
        async (tx) => {
          const advisory = await tx.$queryRaw<
            Array<{ locked: boolean }>
          >`SELECT pg_try_advisory_xact_lock(hashtextextended(${`pms.customer-import:${claim.organizationId}`},0)) AS locked`;
          if (!advisory[0]?.locked) {
            await tx.customerImport.updateMany({
              where: { id: claim.id, state: 'PROCESSING', leaseToken: claim.leaseToken },
              data: {
                state: 'QUEUED',
                nextAttemptAt: new Date(Date.now() + 250),
                leaseToken: null,
                leaseExpiresAt: null,
              },
            });
            return false;
          }
          const metadata = await tx.customerImport.findUnique({
            where: { id: claim.id },
            select: { organizationId: true, businessId: true },
          });
          if (
            !metadata ||
            metadata.organizationId !== claim.organizationId ||
            metadata.businessId !== claim.businessId
          )
            return false;
          await tx.$queryRaw`SELECT id FROM organizations WHERE id=${claim.organizationId}::uuid FOR UPDATE`;
          await tx.$queryRaw`SELECT id FROM businesses WHERE id=${claim.businessId}::uuid AND organization_id=${claim.organizationId}::uuid FOR UPDATE`;
          await tx.$queryRaw`SELECT id FROM customer_imports WHERE id=${claim.id}::uuid AND organization_id=${claim.organizationId}::uuid FOR UPDATE`;
          const run = (await tx.customerImport.findUnique({
              where: { id: claim.id },
            })) as Job | null,
            now = new Date();
          if (
            !run ||
            run.state !== 'PROCESSING' ||
            run.leaseToken !== claim.leaseToken ||
            !run.leaseExpiresAt ||
            run.leaseExpiresAt <= now
          )
            return false;
          if (!(await this.authorized(tx, run, now))) {
            await this.failTx(tx, run, claim.leaseToken, 'OWNER_UNAVAILABLE', now);
            return false;
          }
          const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM customer_import_rows WHERE import_id=${run.id}::uuid AND organization_id=${run.organizationId}::uuid
         AND outcome='PENDING' ORDER BY ordinal LIMIT ${BATCH_SIZE} FOR UPDATE`;
          if (!locked.length) {
            await this.completeTx(tx, run, claim.leaseToken, now);
            return false;
          }
          const rows = (await tx.customerImportRow.findMany({
            where: { id: { in: locked.map((x) => x.id) } },
            orderBy: { ordinal: 'asc' },
            select: { id: true, ordinal: true, input: true },
          })) as PendingRow[];
          const result = await this.processBatch(tx, run, rows);
          const processed = run.processedRows + rows.length;
          const terminal = processed >= run.totalRows;
          const update = await tx.customerImport.updateMany({
            where: { id: run.id, state: 'PROCESSING', leaseToken: claim.leaseToken },
            data: {
              processedRows: processed,
              createdCount: run.createdCount + result.created,
              linkedCount: run.linkedCount + result.linked,
              unchangedCount: run.unchangedCount + result.unchanged,
              skippedCount: run.skippedCount + result.skipped,
              ...(terminal
                ? {
                    state: 'COMPLETED',
                    completedAt: now,
                    undoDeadline: new Date(now.getTime() + CUSTOMER_IMPORT_UNDO_TTL_MS),
                    contentsExpireAt: new Date(now.getTime() + CONTENTS_TTL_MS),
                    leaseToken: null,
                    leaseExpiresAt: null,
                    errorCode: null,
                  }
                : { leaseExpiresAt: new Date(now.getTime() + LEASE_MS), nextAttemptAt: now }),
            },
          });
          if (update.count !== 1) throw new Error('CUSTOMER_IMPORT_LEASE_LOST');
          if (terminal)
            await this.audit(tx, run, 'beauty.customer_import.completed', {
              processedRows: processed,
              createdCount: run.createdCount + result.created,
              linkedCount: run.linkedCount + result.linked,
              unchangedCount: run.unchangedCount + result.unchanged,
              skippedCount: run.skippedCount + result.skipped,
            });
          return !terminal;
        },
        { maxWait: 5000, timeout: 10000 },
      );
    } catch {
      await this.retryAfterFailure(claim);
      return false;
    }
  }

  private async retryAfterFailure(claim: CustomerImportClaim): Promise<void> {
    const now = new Date();
    await this.prisma.db.$transaction(async (tx) => {
      const run = (await tx.customerImport.findFirst({
        where: {
          id: claim.id,
          organizationId: claim.organizationId,
          businessId: claim.businessId,
          state: 'PROCESSING',
          leaseToken: claim.leaseToken,
        },
      })) as Job | null;
      if (!run) return;
      if (run.attempts < 5) {
        await tx.customerImport.updateMany({
          where: { id: run.id, state: 'PROCESSING', leaseToken: claim.leaseToken },
          data: {
            state: 'QUEUED',
            nextAttemptAt: new Date(
              now.getTime() + Math.min(30_000, 250 * 2 ** Math.max(0, run.attempts - 1)),
            ),
            leaseToken: null,
            leaseExpiresAt: null,
            errorCode: 'BATCH_RETRY',
          },
        });
        return;
      }
      await this.failTx(tx, run, claim.leaseToken, 'BATCH_FAILED', now);
    });
  }

  private async authorized(tx: DbTx, run: Job, now: Date) {
    const [user, membership, organization, business] = await Promise.all([
      tx.user.findFirst({ where: { id: run.createdBy, status: 'ACTIVE' }, select: { id: true } }),
      tx.membership.findFirst({
        where: {
          userId: run.createdBy,
          organizationId: run.organizationId,
          role: 'OWNER',
          status: 'ACTIVE',
        },
        select: { userId: true },
      }),
      tx.organization.findUnique({
        where: { id: run.organizationId },
        select: { status: true, trialEndsAt: true },
      }),
      tx.business.findFirst({
        where: {
          id: run.businessId,
          organizationId: run.organizationId,
          vertical: 'BEAUTY',
          status: 'ACTIVE',
        },
        select: { id: true },
      }),
    ]);
    return (
      !!user &&
      !!membership &&
      !!organization &&
      canWrite(organization.status, organization.trialEndsAt, now) &&
      !!business
    );
  }

  private async processBatch(tx: DbTx, run: Job, rows: PendingRow[]) {
    const prepared = rows.map((row) => ({ row, input: parsedInput(row.input) }));
    const phoneKeys = [
      ...new Set(
        prepared.flatMap((x) =>
          x.input?.phone ? [customerPhoneKey(x.input.phone)].filter((v): v is string => !!v) : [],
        ),
      ),
    ];
    const known = phoneKeys.length
      ? await tx.customer.findMany({
          where: { organizationId: run.organizationId, phoneNormalized: { in: phoneKeys } },
          select: customerSelect,
        })
      : [];
    const byPhone = new Map(
      known.flatMap((c) => (c.phoneNormalized ? [[c.phoneNormalized, c] as const] : [])),
    );
    const candidates: Array<{
      id: string;
      organizationId: string;
      firstName: string;
      lastName: string | null;
      phone: string | null;
    }> = [];
    const candidateFor = new Map<string, string>();
    for (const { row, input } of prepared) {
      if (!input) continue;
      const key = input.phone ? customerPhoneKey(input.phone) : null;
      if ((key && byPhone.has(key)) || (key && candidateFor.has(key))) continue;
      const id = randomUUID();
      candidates.push({ id, organizationId: run.organizationId, ...input });
      if (key) candidateFor.set(key, id);
      else candidateFor.set(`row:${row.id}`, id);
    }
    if (candidates.length) await tx.customer.createMany({ data: candidates, skipDuplicates: true });
    const candidateIds = candidates.map((x) => x.id);
    const createdRows = candidateIds.length
      ? await tx.customer.findMany({
          where: { id: { in: candidateIds }, organizationId: run.organizationId },
          select: customerSelect,
        })
      : [];
    const customersById = new Map(createdRows.map((x) => [x.id, x]));
    if (phoneKeys.length) {
      const refreshed = await tx.customer.findMany({
        where: { organizationId: run.organizationId, phoneNormalized: { in: phoneKeys } },
        select: customerSelect,
      });
      for (const c of refreshed) if (c.phoneNormalized) byPhone.set(c.phoneNormalized, c);
    }
    const targetIds = [
      ...new Set(
        prepared.flatMap(({ row, input }) => {
          if (!input) return [];
          const key = input.phone ? customerPhoneKey(input.phone) : null;
          const customer = key
            ? byPhone.get(key)
            : customersById.get(candidateFor.get(`row:${row.id}`) ?? '');
          return customer?.status === 'ACTIVE' ? [customer.id] : [];
        }),
      ),
    ].sort();
    for (const customerId of targetIds)
      await tx.$queryRaw`SELECT id FROM customers WHERE id=${customerId}::uuid AND organization_id=${run.organizationId}::uuid FOR UPDATE`;
    const lockedCustomers = targetIds.length
      ? await tx.customer.findMany({
          where: { id: { in: targetIds }, organizationId: run.organizationId },
          select: customerSelect,
        })
      : [];
    const lockedById = new Map(lockedCustomers.map((customer) => [customer.id, customer]));
    const activeTargetIds = targetIds.filter((id) => lockedById.get(id)?.status === 'ACTIVE');
    const links = activeTargetIds.length
      ? await tx.customerBusiness.findMany({
          where: { businessId: run.businessId, customerId: { in: activeTargetIds } },
          select: { customerId: true, createdAt: true },
        })
      : [];
    const linkByCustomer = new Map(links.map((x) => [x.customerId, x]));
    const missingLinks = activeTargetIds.filter((id) => !linkByCustomer.has(id));
    if (missingLinks.length)
      await tx.customerBusiness.createMany({
        data: missingLinks.map((customerId) => ({ customerId, businessId: run.businessId })),
        skipDuplicates: true,
      });
    if (missingLinks.length) {
      const saved = await tx.customerBusiness.findMany({
        where: { businessId: run.businessId, customerId: { in: missingLinks } },
        select: { customerId: true, createdAt: true },
      });
      for (const link of saved) linkByCustomer.set(link.customerId, link);
    }
    let created = 0,
      linked = 0,
      unchanged = 0,
      skipped = 0;
    const seenTargets = new Set<string>();
    for (const { row, input } of prepared) {
      if (!input) {
        await tx.customerImportRow.update({
          where: { id: row.id },
          data: { outcome: 'SKIPPED', errorCode: 'INVALID_STORED_INPUT' },
        });
        skipped++;
        continue;
      }
      const key = input.phone ? customerPhoneKey(input.phone) : null;
      const beforeLock = key
        ? byPhone.get(key)
        : customersById.get(candidateFor.get(`row:${row.id}`) ?? '');
      const customer = beforeLock?.status === 'ACTIVE' ? lockedById.get(beforeLock.id) : beforeLock;
      if (!customer || customer.status !== 'ACTIVE') {
        await tx.customerImportRow.update({
          where: { id: row.id },
          data: {
            outcome: 'SKIPPED',
            errorCode: customer ? 'CUSTOMER_ARCHIVED' : 'CUSTOMER_CONFLICT',
          },
        });
        skipped++;
        continue;
      }
      const repeated = seenTargets.has(customer.id),
        createdHere = customersById.has(customer.id),
        hadLink = links.some((x) => x.customerId === customer.id);
      const outcome = repeated || hadLink ? 'UNCHANGED' : createdHere ? 'CREATED' : 'LINKED';
      seenTargets.add(customer.id);
      await tx.customerImportRow.update({
        where: { id: row.id },
        data: {
          outcome,
          customerId: customer.id,
          errorCode: null,
          customerBaseline: outcome === 'CREATED' ? snapshot(customer) : Prisma.DbNull,
          linkBaseline:
            outcome === 'CREATED' || outcome === 'LINKED'
              ? (linkByCustomer.get(customer.id)?.createdAt ?? null)
              : null,
        },
      });
      if (outcome === 'CREATED') created++;
      else if (outcome === 'LINKED') linked++;
      else unchanged++;
    }
    return { created, linked, unchanged, skipped };
  }

  private async completeTx(tx: DbTx, run: Job, token: string, now: Date) {
    if (run.processedRows < run.totalRows) {
      await this.failTx(tx, run, token, 'ROWS_MISSING', now);
      return;
    }
    const done = await tx.customerImport.updateMany({
      where: { id: run.id, state: 'PROCESSING', leaseToken: token },
      data: {
        state: 'COMPLETED',
        completedAt: now,
        undoDeadline: new Date(now.getTime() + CUSTOMER_IMPORT_UNDO_TTL_MS),
        contentsExpireAt: new Date(now.getTime() + CONTENTS_TTL_MS),
        leaseToken: null,
        leaseExpiresAt: null,
        errorCode: null,
      },
    });
    if (done.count)
      await this.audit(tx, run, 'beauty.customer_import.completed', {
        processedRows: run.processedRows,
        createdCount: run.createdCount,
        linkedCount: run.linkedCount,
        unchangedCount: run.unchangedCount,
        skippedCount: run.skippedCount,
      });
  }
  private async failTx(tx: DbTx, run: Job, token: string, code: string, now: Date) {
    const partial = run.processedRows > 0;
    const done = await tx.customerImport.updateMany({
      where: { id: run.id, state: 'PROCESSING', leaseToken: token },
      data: {
        state: 'FAILED',
        errorCode: code,
        completedAt: now,
        undoDeadline: partial ? new Date(now.getTime() + CUSTOMER_IMPORT_UNDO_TTL_MS) : null,
        contentsExpireAt: new Date(now.getTime() + CONTENTS_TTL_MS),
        leaseToken: null,
        leaseExpiresAt: null,
      },
    });
    if (done.count)
      await this.audit(tx, run, 'beauty.customer_import.failed', {
        errorCode: code,
        processedRows: run.processedRows,
      });
  }
  private audit(tx: DbTx, run: Job, action: string, after: Prisma.InputJsonObject) {
    return tx.auditLog.create({
      data: {
        organizationId: run.organizationId,
        userId: run.createdBy,
        entityType: 'customer_import',
        entityId: run.id,
        action,
        after,
      },
    });
  }

  async purgeExpiredContents(): Promise<number> {
    const now = new Date();
    return this.prisma.db.$transaction(async (tx) => {
      const jobs = await tx.$queryRaw<
        Array<{
          id: string;
          state: string;
          organizationId: string;
          createdBy: string;
          totalRows: number;
          uploadedRows: number;
          processedRows: number;
        }>
      >`SELECT id,state,organization_id AS "organizationId",created_by AS "createdBy",total_rows AS "totalRows",uploaded_rows AS "uploadedRows",processed_rows AS "processedRows" FROM customer_imports WHERE contents_expire_at<=${now} AND (state='UPLOADING' OR (state IN ('COMPLETED','FAILED','UNDONE') AND (upload_receipts<>'{}'::jsonb OR EXISTS(SELECT 1 FROM customer_import_rows r WHERE r.import_id=customer_imports.id AND (r.input IS NOT NULL OR r.customer_baseline IS NOT NULL OR r.link_baseline IS NOT NULL))))) ORDER BY contents_expire_at,id LIMIT 20 FOR UPDATE SKIP LOCKED`;
      for (const job of jobs) {
        if (job.state === 'UPLOADING') {
          await tx.customerImport.update({
            where: { id: job.id },
            data: {
              state: 'FAILED',
              errorCode: 'UPLOAD_EXPIRED',
              completedAt: now,
              undoDeadline: null,
              leaseToken: null,
              leaseExpiresAt: null,
              uploadReceipts: {},
            },
          });
        } else {
          await tx.customerImport.update({
            where: { id: job.id },
            data: { uploadReceipts: {} },
          });
        }
        if (job.state === 'UPLOADING') {
          await tx.auditLog.create({
            data: {
              organizationId: job.organizationId,
              userId: job.createdBy,
              entityType: 'customer_import',
              entityId: job.id,
              action: 'beauty.customer_import.failed',
              after: {
                errorCode: 'UPLOAD_EXPIRED',
                totalRows: job.totalRows,
                uploadedRows: job.uploadedRows,
                processedRows: job.processedRows,
              },
            },
          });
        }
        await tx.customerImportRow.updateMany({
          where: { importId: job.id },
          data: { input: Prisma.DbNull, customerBaseline: Prisma.DbNull, linkBaseline: null },
        });
      }
      return jobs.length;
    });
  }
}
