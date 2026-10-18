import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  canWrite,
  CustomerImportError,
  customerImportRowInput,
  parseCustomerImportChunk,
  parseCustomerImportStart,
  type CustomerImportState,
  type CustomerImportView,
} from '@pms/domain';
import { Prisma } from '@pms/database';
import { RequiresBusinessCapability } from '../auth/capability.decorator';
import { Access } from '../auth/access.decorator';
import { currentRole, currentUserId, hasSignedInActor } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { beautyScope, beautyTransaction, mayBeauty, mayBeautyWrite, UUID } from './scope';

const CONTENTS_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const CUSTOMER_IMPORT_UNDO_TTL_MS = 24 * 60 * 60 * 1000;
const ROW_PAGE_SIZE = 100;

type ImportRecord = {
  id: string;
  state: string;
  totalRows: number;
  uploadedRows: number;
  processedRows: number;
  createdCount: number;
  linkedCount: number;
  unchangedCount: number;
  skippedCount: number;
  errorCode: string | null;
  createdAt: Date;
  completedAt: Date | null;
  undoDeadline: Date | null;
  contentsExpireAt: Date;
};

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
};
const receiptsOf = (value: unknown): Record<string, string> =>
  !value || typeof value !== 'object' || Array.isArray(value)
    ? {}
    : Object.fromEntries(
        Object.entries(value).filter((x): x is [string, string] => typeof x[1] === 'string'),
      );

function dto(row: ImportRecord, now = new Date()): CustomerImportView {
  return {
    id: row.id,
    state: row.state as CustomerImportState,
    totalRows: row.totalRows,
    uploadedRows: row.uploadedRows,
    processedRows: row.processedRows,
    createdCount: row.createdCount,
    linkedCount: row.linkedCount,
    unchangedCount: row.unchangedCount,
    skippedCount: row.skippedCount,
    errorCode: row.errorCode,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    undoDeadline: row.undoDeadline?.toISOString() ?? null,
    contentsExpired: row.contentsExpireAt.getTime() <= now.getTime(),
  };
}
function ownerOnly() {
  if (!hasSignedInActor() || currentRole() !== 'OWNER')
    throw new ForbiddenException('Импорт клиентов доступен только владельцу');
}
function badInput(error: unknown): never {
  if (error instanceof CustomerImportError)
    throw new BadRequestException(
      error.code === 'PAYLOAD_TOO_LARGE'
        ? 'Часть импорта больше 64 КБ'
        : 'Проверьте данные импорта',
    );
  throw error;
}

@Injectable()
export class CustomerImportService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private async readScope() {
    ownerOnly();
    mayBeauty('desk');
    return beautyScope(this.prisma);
  }
  private async writeScope() {
    ownerOnly();
    await mayBeautyWrite(this.prisma, 'desk');
    return beautyScope(this.prisma);
  }

  async start(raw: unknown): Promise<CustomerImportView> {
    let input;
    try {
      input = parseCustomerImportStart(raw);
    } catch (e) {
      badInput(e);
    }
    const scope = await this.writeScope(),
      actor = currentUserId();
    if (!actor) throw new ForbiddenException('Войдите в организацию');
    const requestDigest = digest({ totalRows: input.totalRows });
    const key = { organizationId: scope.organizationId, clientRequestId: input.clientRequestId };
    const prior = await this.prisma.db.customerImport.findUnique({
      where: { organizationId_clientRequestId: key },
    });
    if (prior) {
      if (prior.requestDigest !== requestDigest || prior.businessId !== scope.businessId)
        throw new ConflictException('Идентификатор уже использован для другого импорта');
      return dto(prior);
    }
    const now = new Date();
    try {
      return dto(
        await beautyTransaction(this.prisma, scope, async (tx) => {
          const repeated = await tx.customerImport.findUnique({
            where: { organizationId_clientRequestId: key },
          });
          if (repeated) {
            if (
              repeated.requestDigest !== requestDigest ||
              repeated.businessId !== scope.businessId
            )
              throw new ConflictException('Идентификатор уже использован для другого импорта');
            return repeated;
          }
          return tx.customerImport.create({
            data: {
              id: randomUUID(),
              organizationId: scope.organizationId,
              businessId: scope.businessId,
              createdBy: actor,
              clientRequestId: input.clientRequestId,
              requestDigest,
              state: 'UPLOADING',
              totalRows: input.totalRows,
              contentsExpireAt: new Date(now.getTime() + CONTENTS_TTL_MS),
              nextAttemptAt: now,
            },
          });
        }),
        now,
      );
    } catch (e) {
      if (!(e instanceof ConflictException) && (e as { code?: string })?.code !== 'P2002') throw e;
      const repeated = await this.prisma.db.customerImport.findUnique({
        where: { organizationId_clientRequestId: key },
      });
      if (
        !repeated ||
        repeated.requestDigest !== requestDigest ||
        repeated.businessId !== scope.businessId
      )
        throw new ConflictException('Идентификатор уже использован для другого импорта');
      return dto(repeated);
    }
  }

  async uploadRows(id: string, raw: unknown): Promise<CustomerImportView> {
    if (!UUID.test(id)) throw new BadRequestException('Проверьте идентификатор импорта');
    let chunk;
    try {
      chunk = parseCustomerImportChunk(raw);
    } catch (e) {
      badInput(e);
    }
    const scope = await this.writeScope(),
      chunkDigest = digest(chunk),
      now = new Date();
    return beautyTransaction(this.prisma, scope, async (tx) => {
      await tx.$queryRaw`SELECT id FROM customer_imports WHERE id=${id}::uuid AND organization_id=${scope.organizationId}::uuid FOR UPDATE`;
      const run = await tx.customerImport.findFirst({
        where: { id, organizationId: scope.organizationId, businessId: scope.businessId },
      });
      if (!run) throw new NotFoundException('Импорт не найден');
      const receipts = receiptsOf(run.uploadReceipts),
        previous = receipts[String(chunk.offset)];
      if (previous) {
        if (previous !== chunkDigest)
          throw new ConflictException('Часть уже загружена с другими данными');
        return dto(run, now);
      }
      if (run.state !== 'UPLOADING') throw new ConflictException('Загрузка уже закрыта');
      if (chunk.offset !== run.uploadedRows)
        throw new ConflictException('Загрузите предыдущую часть импорта');
      if (chunk.offset + chunk.rows.length > run.totalRows)
        throw new BadRequestException('Строк больше, чем заявлено');
      const rows = chunk.rows.map((source, index) => {
        const parsed = customerImportRowInput(source);
        return {
          id: randomUUID(),
          organizationId: scope.organizationId,
          importId: id,
          ordinal: chunk.offset + index,
          sourceLine: source.sourceLine,
          input: parsed.ok
            ? {
                firstName: parsed.value.firstName,
                lastName: parsed.value.lastName,
                phone: parsed.value.phone,
              }
            : Prisma.DbNull,
          outcome: parsed.ok ? 'PENDING' : 'SKIPPED',
          errorCode: parsed.ok ? null : parsed.code,
        };
      });
      await tx.customerImportRow.createMany({ data: rows });
      const skipped = rows.filter((x) => x.outcome === 'SKIPPED').length;
      return dto(
        await tx.customerImport.update({
          where: { id },
          data: {
            uploadedRows: run.uploadedRows + rows.length,
            processedRows: run.processedRows + skipped,
            skippedCount: run.skippedCount + skipped,
            uploadReceipts: { ...receipts, [String(chunk.offset)]: chunkDigest },
          },
        }),
        now,
      );
    });
  }

  async submit(id: string): Promise<CustomerImportView> {
    if (!UUID.test(id)) throw new BadRequestException('Проверьте идентификатор импорта');
    const scope = await this.writeScope(),
      now = new Date();
    return beautyTransaction(this.prisma, scope, async (tx) => {
      await tx.$queryRaw`SELECT id FROM customer_imports WHERE id=${id}::uuid AND organization_id=${scope.organizationId}::uuid FOR UPDATE`;
      const run = await tx.customerImport.findFirst({
        where: { id, organizationId: scope.organizationId, businessId: scope.businessId },
      });
      if (!run) throw new NotFoundException('Импорт не найден');
      if (['QUEUED', 'PROCESSING', 'COMPLETED'].includes(run.state)) return dto(run, now);
      if (run.state !== 'UPLOADING') throw new ConflictException('Этот импорт нельзя запустить');
      if (run.uploadedRows !== run.totalRows)
        throw new ConflictException('Загрузите все строки перед запуском');
      const updated = await tx.customerImport.update({
        where: { id },
        data: { state: 'QUEUED', nextAttemptAt: now, errorCode: null },
      });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId: currentUserId(),
          entityType: 'customer_import',
          entityId: id,
          action: 'beauty.customer_import.queued',
          after: { totalRows: run.totalRows },
        },
      });
      return dto(updated, now);
    });
  }

  private async ownImport(id: string) {
    if (!UUID.test(id)) throw new BadRequestException('Проверьте идентификатор импорта');
    const scope = await this.readScope();
    const run = await this.prisma.db.customerImport.findFirst({
      where: { id, organizationId: scope.organizationId, businessId: scope.businessId },
    });
    if (!run) throw new NotFoundException('Импорт не найден');
    return { scope, run };
  }
  async get(id: string) {
    const { run } = await this.ownImport(id);
    return dto(run);
  }
  async list() {
    const scope = await this.readScope(),
      now = new Date();
    const rows = await this.prisma.db.customerImport.findMany({
      where: { organizationId: scope.organizationId, businessId: scope.businessId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 20,
    });
    return { items: rows.map((x) => dto(x, now)) };
  }
  async rows(id: string, offset?: string) {
    const { scope, run } = await this.ownImport(id),
      n = offset === undefined ? 0 : Number(offset);
    if (!Number.isSafeInteger(n) || n < 0 || n > run.totalRows)
      throw new BadRequestException('Проверьте смещение строк');
    const rows = await this.prisma.db.customerImportRow.findMany({
      where: { importId: id, organizationId: scope.organizationId },
      orderBy: { ordinal: 'asc' },
      skip: n,
      take: ROW_PAGE_SIZE + 1,
      select: {
        ordinal: true,
        sourceLine: true,
        input: true,
        outcome: true,
        errorCode: true,
        customerId: true,
      },
    });
    return {
      items: rows.slice(0, ROW_PAGE_SIZE).map((x) => ({
        ...x,
        input: run.contentsExpireAt.getTime() <= Date.now() ? null : x.input,
      })),
      nextOffset: rows.length > ROW_PAGE_SIZE ? n + ROW_PAGE_SIZE : null,
    };
  }

  async undo(id: string): Promise<CustomerImportView> {
    if (!UUID.test(id)) throw new BadRequestException('Проверьте идентификатор импорта');
    const scope = await this.writeScope();
    return this.prisma.db.$transaction(
      async (tx) => {
        const advisory = await tx.$queryRaw<
          Array<{ locked: boolean }>
        >`SELECT pg_try_advisory_xact_lock(hashtextextended(${`pms.customer-import:${scope.organizationId}`},0)) AS locked`;
        if (!advisory[0]?.locked)
          throw new ConflictException('Другой импорт этой организации ещё обрабатывается');
        await tx.$queryRaw`SELECT id FROM organizations WHERE id=${scope.organizationId}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM businesses WHERE id=${scope.businessId}::uuid AND organization_id=${scope.organizationId}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM customer_imports WHERE id=${id}::uuid AND organization_id=${scope.organizationId}::uuid FOR UPDATE`;
        const now = new Date();
        const run = await tx.customerImport.findFirst({
          where: { id, organizationId: scope.organizationId, businessId: scope.businessId },
        });
        if (!run) throw new NotFoundException('Импорт не найден');
        const actor = currentUserId();
        const [user, membership, organization, business] = await Promise.all([
          actor
            ? tx.user.findFirst({ where: { id: actor, status: 'ACTIVE' }, select: { id: true } })
            : null,
          actor
            ? tx.membership.findFirst({
                where: {
                  userId: actor,
                  organizationId: scope.organizationId,
                  role: 'OWNER',
                  status: 'ACTIVE',
                },
                select: { userId: true },
              })
            : null,
          tx.organization.findUnique({
            where: { id: scope.organizationId },
            select: { status: true, trialEndsAt: true },
          }),
          tx.business.findFirst({
            where: {
              id: scope.businessId,
              organizationId: scope.organizationId,
              vertical: 'BEAUTY',
              status: 'ACTIVE',
            },
            select: { id: true },
          }),
        ]);
        if (
          !user ||
          !membership ||
          !organization ||
          !canWrite(organization.status, organization.trialEndsAt, now) ||
          !business
        )
          throw new ForbiddenException('Импорт клиентов больше недоступен');
        if (run.state === 'UNDONE') return dto(run, now);
        if (!(run.state === 'COMPLETED' || (run.state === 'FAILED' && run.processedRows > 0)))
          throw new ConflictException('Срок безопасной отмены истёк или импорт не завершён');
        const changed = await tx.customerImportRow.findMany({
          where: {
            importId: id,
            organizationId: scope.organizationId,
            outcome: { in: ['CREATED', 'LINKED'] },
          },
          orderBy: [{ customerId: 'asc' }, { ordinal: 'asc' }],
        });
        const ids = [
          ...new Set(changed.flatMap((x) => (x.customerId ? [x.customerId] : []))),
        ].sort();
        if (ids.length)
          await tx.$queryRaw`SELECT c.id FROM customers c WHERE c.organization_id=${scope.organizationId}::uuid AND EXISTS(SELECT 1 FROM customer_import_rows r WHERE r.import_id=${id}::uuid AND r.customer_id=c.id AND r.outcome IN ('CREATED','LINKED')) ORDER BY c.id FOR UPDATE`;
        type SnapshotRow = {
          id: string;
          organizationId: string;
          firstName: string;
          lastName: string | null;
          phone: string | null;
          phoneNormalized: string | null;
          email: string | null;
          notes: string | null;
          status: string;
          isVip: boolean;
          birthDate: Date | null;
          createdAt: Date;
          updatedAt: Date;
        };
        const customers = ids.length
          ? await tx.$queryRaw<SnapshotRow[]>`
        SELECT c.id,c.organization_id AS "organizationId",c.first_name AS "firstName",c.last_name AS "lastName",
               c.phone,c.phone_normalized AS "phoneNormalized",c.email,c.notes,c.status,c.is_vip AS "isVip",
               c.birth_date AS "birthDate",c.created_at AS "createdAt",c.updated_at AS "updatedAt"
          FROM customers c JOIN customer_import_rows r ON r.customer_id=c.id
         WHERE r.import_id=${id}::uuid AND r.outcome='CREATED' ORDER BY c.id`
          : [];
        const allAppointments = ids.length
          ? await tx.$queryRaw<Array<{ customerId: string }>>`
        SELECT DISTINCT a.customer_id AS "customerId" FROM appointments a JOIN customer_import_rows r ON r.customer_id=a.customer_id WHERE r.import_id=${id}::uuid AND r.outcome='CREATED'`
          : [];
        const allRestaurants = ids.length
          ? await tx.$queryRaw<Array<{ customerId: string }>>`
        SELECT DISTINCT rr.customer_id AS "customerId" FROM restaurant_reservations rr JOIN customer_import_rows r ON r.customer_id=rr.customer_id WHERE r.import_id=${id}::uuid AND r.outcome='CREATED'`
          : [];
        const otherLinks = ids.length
          ? await tx.$queryRaw<Array<{ customerId: string }>>`
        SELECT DISTINCT cb.customer_id AS "customerId" FROM customer_businesses cb JOIN customer_import_rows r ON r.customer_id=cb.customer_id WHERE r.import_id=${id}::uuid AND r.outcome='CREATED' AND cb.business_id<>${scope.businessId}::uuid`
          : [];
        const currentLinks = ids.length
          ? await tx.$queryRaw<Array<{ customerId: string; createdAt: Date }>>`
        SELECT cb.customer_id AS "customerId",cb.created_at AS "createdAt" FROM customer_businesses cb JOIN customer_import_rows r ON r.customer_id=cb.customer_id WHERE r.import_id=${id}::uuid AND r.outcome IN ('CREATED','LINKED') AND cb.business_id=${scope.businessId}::uuid`
          : [];
        const businessAppointments = ids.length
          ? await tx.$queryRaw<Array<{ customerId: string }>>`
        SELECT DISTINCT a.customer_id AS "customerId" FROM appointments a JOIN locations l ON l.id=a.location_id JOIN customer_import_rows r ON r.customer_id=a.customer_id WHERE r.import_id=${id}::uuid AND r.outcome='LINKED' AND l.business_id=${scope.businessId}::uuid`
          : [];
        const businessRestaurants = ids.length
          ? await tx.$queryRaw<Array<{ customerId: string }>>`
        SELECT DISTINCT rr.customer_id AS "customerId" FROM restaurant_reservations rr JOIN locations l ON l.id=rr.location_id JOIN customer_import_rows r ON r.customer_id=rr.customer_id WHERE r.import_id=${id}::uuid AND r.outcome='LINKED' AND l.business_id=${scope.businessId}::uuid`
          : [];
        const customerById = new Map(customers.map((customer) => [customer.id, customer]));
        const blockedCreated = new Set(
          [...allAppointments, ...allRestaurants, ...otherLinks].map((item) => item.customerId),
        );
        const linkById = new Map(currentLinks.map((link) => [link.customerId, link.createdAt]));
        const blockedLinked = new Set(
          [...businessAppointments, ...businessRestaurants].map((item) => item.customerId),
        );
        for (const row of changed) {
          if (!row.customerId) throw new ConflictException('Импорт изменён, отмена невозможна');
          if (row.outcome === 'CREATED') {
            const customer = customerById.get(row.customerId);
            const link = linkById.get(row.customerId);
            if (
              !customer ||
              !row.customerBaseline ||
              !row.linkBaseline ||
              !link ||
              link.getTime() !== row.linkBaseline.getTime() ||
              canonicalJson(row.customerBaseline) !==
                canonicalJson(JSON.parse(JSON.stringify(customer))) ||
              blockedCreated.has(row.customerId)
            )
              throw new ConflictException('После импорта клиент был изменён или использован');
          } else {
            const link = linkById.get(row.customerId);
            if (
              !link ||
              !row.linkBaseline ||
              link.getTime() !== row.linkBaseline.getTime() ||
              blockedLinked.has(row.customerId)
            )
              throw new ConflictException('После импорта клиент был использован в этом бизнесе');
          }
        }
        const undoNow = new Date();
        if (!run.undoDeadline || undoNow >= run.undoDeadline)
          throw new ConflictException('Срок безопасной отмены истёк или импорт не завершён');
        await tx.customerImport.update({ where: { id }, data: { state: 'UNDOING' } });
        if (ids.length) {
          await tx.$executeRaw`DELETE FROM customer_businesses cb USING customer_import_rows r WHERE r.import_id=${id}::uuid AND r.customer_id=cb.customer_id AND r.outcome IN ('CREATED','LINKED') AND cb.business_id=${scope.businessId}::uuid`;
          await tx.$executeRaw`DELETE FROM customers c USING customer_import_rows r WHERE r.import_id=${id}::uuid AND r.customer_id=c.id AND r.outcome='CREATED' AND c.organization_id=${scope.organizationId}::uuid`;
        }
        const updated = await tx.customerImport.update({
          where: { id },
          data: { state: 'UNDONE', leaseToken: null, leaseExpiresAt: null },
        });
        await tx.auditLog.create({
          data: {
            organizationId: scope.organizationId,
            userId: currentUserId(),
            entityType: 'customer_import',
            entityId: id,
            action: 'beauty.customer_import.undone',
            after: {
              createdCount: run.createdCount,
              linkedCount: run.linkedCount,
              processedRows: run.processedRows,
            },
          },
        });
        return dto(updated, undoNow);
      },
      { maxWait: 5000, timeout: 10000 },
    );
  }
}

@Controller('beauty/customer-imports')
@Access('owner')
@RequiresBusinessCapability('beauty.customers')
export class CustomerImportsController {
  constructor(@Inject(CustomerImportService) private readonly service: CustomerImportService) {}
  @Post() start(@Body() body: unknown) {
    return this.service.start(body);
  }
  @Put(':id/rows') uploadRows(@Param('id') id: string, @Body() body: unknown) {
    return this.service.uploadRows(id, body);
  }
  @Post(':id/submit') submit(@Param('id') id: string) {
    return this.service.submit(id);
  }
  @Get() list() {
    return this.service.list();
  }
  @Get(':id') get(@Param('id') id: string) {
    return this.service.get(id);
  }
  @Get(':id/rows') rows(@Param('id') id: string, @Query('offset') offset?: string) {
    return this.service.rows(id, offset);
  }
  @Post(':id/undo') undo(@Param('id') id: string) {
    return this.service.undo(id);
  }
}
