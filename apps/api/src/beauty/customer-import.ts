import { Buffer } from 'node:buffer';
import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
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
  BeautyCustomerImportError,
  normalizeBeautyCustomerPhone,
  parseBeautyCustomersCsv,
  type ImportedBeautyCustomer,
} from '@pms/domain';
import { Prisma } from '@pms/database';
import { Access } from '../auth/access.decorator';
import { BeautyAccess } from './access.decorator';
import { RequiresBusinessCapability } from '../auth/capability.decorator';
import { currentRole, currentUserId, hasSignedInActor } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { beautyScope, beautyTransaction, mayBeauty, mayBeautyWrite, UUID } from './scope';
import { lockBeautyCustomerPhones } from './customer-identity';

export type BeautyCustomerImportStatus =
  | 'CREATE'
  | 'ALREADY_EXISTS'
  | 'CONFLICT'
  | 'DUPLICATE_IN_FILE';

export interface BeautyCustomerImportPreviewRow {
  line: number;
  name: string;
  phone: string;
  status: BeautyCustomerImportStatus;
}

const CSV_MAX_BYTES = 100 * 1024;

type ExistingCustomer = {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
};

const fullName = (row: Pick<ExistingCustomer, 'firstName' | 'lastName'>) =>
  [row.firstName, row.lastName].filter(Boolean).join(' ');

const normalizedExistingPhone = (row: ExistingCustomer) => {
  try {
    return normalizeBeautyCustomerPhone(row.phone);
  } catch {
    return null;
  }
};

function csvOf(raw: unknown): string {
  const csv = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).csv : null;
  if (typeof csv !== 'string') throw new BadRequestException('Выберите CSV-файл');
  if (Buffer.byteLength(csv, 'utf8') > CSV_MAX_BYTES) {
    throw new BadRequestException('CSV-файл должен быть не больше 100 КБ');
  }
  return csv;
}

function parsedCsv(raw: unknown): ImportedBeautyCustomer[] {
  try {
    return parseBeautyCustomersCsv(csvOf(raw));
  } catch (error) {
    if (error instanceof BeautyCustomerImportError) throw new BadRequestException(error.message);
    throw error;
  }
}

function classify(
  rows: ImportedBeautyCustomer[],
  existing: ExistingCustomer[],
): BeautyCustomerImportPreviewRow[] {
  const byPhone = new Map<string, ExistingCustomer[]>();
  for (const customer of existing) {
    const phone = normalizedExistingPhone(customer);
    if (!phone) continue;
    byPhone.set(phone, [...(byPhone.get(phone) ?? []), customer]);
  }
  const firstInFile = new Map<string, string>();
  return rows.map((row) => {
    const firstName = firstInFile.get(row.phone);
    if (firstName !== undefined) {
      return {
        ...row,
        status: firstName === row.name ? 'DUPLICATE_IN_FILE' : 'CONFLICT',
      };
    }
    firstInFile.set(row.phone, row.name);
    const found = byPhone.get(row.phone) ?? [];
    if (found.length === 0) return { ...row, status: 'CREATE' };
    if (found.some((customer) => customer.status !== 'ACTIVE' || fullName(customer) !== row.name)) {
      return { ...row, status: 'CONFLICT' };
    }
    return { ...row, status: 'ALREADY_EXISTS' };
  });
}

const totalsOf = (rows: BeautyCustomerImportPreviewRow[]) => ({
  create: rows.filter((row) => row.status === 'CREATE').length,
  alreadyExists: rows.filter((row) => row.status === 'ALREADY_EXISTS').length,
  conflicts: rows.filter((row) => row.status === 'CONFLICT').length,
  duplicatesInFile: rows.filter((row) => row.status === 'DUPLICATE_IN_FILE').length,
});

@Injectable()
export class BeautyCustomerImportService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async preview(raw: unknown): Promise<{
    rows: BeautyCustomerImportPreviewRow[];
    totals: { create: number; alreadyExists: number; conflicts: number; duplicatesInFile: number };
  }> {
    await mayBeautyWrite(this.prisma, 'desk');
    const scope = await beautyScope(this.prisma);
    const parsed = parsedCsv(raw);
    const existing = await this.prisma.db.customer.findMany({
      where: { organizationId: scope.organizationId, phone: { not: null } },
      orderBy: { id: 'asc' },
      select: { id: true, firstName: true, lastName: true, phone: true, status: true },
    });
    const rows = classify(parsed, existing);
    return { rows, totals: totalsOf(rows) };
  }

  async apply(raw: unknown): Promise<{ created: number; linked: number; alreadyExists: number }> {
    ownerOnly();
    await mayBeautyWrite(this.prisma, 'desk');
    const scope = await beautyScope(this.prisma);
    const parsed = parsedCsv(raw);
    return beautyTransaction(this.prisma, scope, async (tx) => {
      await lockBeautyCustomerPhones(tx, scope.organizationId, parsed.map((row) => row.phone));
      const existing = await tx.customer.findMany({
        where: { organizationId: scope.organizationId, phone: { not: null } },
        orderBy: { id: 'asc' },
        select: { id: true, firstName: true, lastName: true, phone: true, status: true },
      });
      const rows = classify(parsed, existing);
      const totals = totalsOf(rows);
      if (totals.conflicts > 0) {
        throw new ConflictException('Импорт не выполнен: исправьте конфликты телефонов и имён');
      }
      const existingByPhone = new Map<string, ExistingCustomer>();
      for (const customer of existing) {
        const phone = normalizedExistingPhone(customer);
        if (phone && !existingByPhone.has(phone)) existingByPhone.set(phone, customer);
      }
      const customerIds: string[] = [];
      let created = 0;
      for (const row of rows) {
        if (row.status === 'DUPLICATE_IN_FILE') continue;
        const found = existingByPhone.get(row.phone);
        if (found) {
          customerIds.push(found.id);
          continue;
        }
        const customer = await tx.customer.create({
          data: {
            organizationId: scope.organizationId,
            firstName: row.name,
            lastName: null,
            phone: row.phone,
          },
          select: { id: true },
        });
        existingByPhone.set(row.phone, {
          id: customer.id,
          firstName: row.name,
          lastName: null,
          phone: row.phone,
          status: 'ACTIVE',
        });
        customerIds.push(customer.id);
        created += 1;
      }
      const links = await tx.customerBusiness.createMany({
        data: customerIds.map((customerId) => ({ customerId, businessId: scope.businessId })),
        skipDuplicates: true,
      });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId: currentUserId(),
          entityType: 'customer_import',
          entityId: scope.businessId,
          action: 'beauty.customers.imported',
          before: {},
          after: {
            source: 'csv',
            rows: parsed.length,
            created,
            linked: links.count,
            alreadyExists: totals.alreadyExists,
            duplicatesInFile: totals.duplicatesInFile,
          },
        },
      });
      return { created, linked: links.count, alreadyExists: totals.alreadyExists };
    });
  }
}

@RequiresBusinessCapability('beauty.customers')
@Access('desk')
@Controller('beauty/customers')
export class BeautyCustomerImportController {
  constructor(@Inject(BeautyCustomerImportService) private readonly service: BeautyCustomerImportService) {}

  @BeautyAccess('customers', 'create')
  @Post('import/preview')
  @HttpCode(200)
  preview(@Body() body: unknown) {
    return this.service.preview(body);
  }

  @BeautyAccess('customers', 'create')
  @Post('import')
  @HttpCode(200)
  apply(@Body() body: unknown) {
    return this.service.apply(body);
  }
}

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
        const [membership] = actor
          ? await tx.$queryRaw<Array<{ role: string; status: string }>>`
              SELECT role,status FROM memberships
              WHERE user_id=${actor}::uuid AND organization_id=${scope.organizationId}::uuid
              FOR SHARE`
          : [];
        const [user, organization, business] = await Promise.all([
          actor
            ? tx.user.findFirst({ where: { id: actor, status: 'ACTIVE' }, select: { id: true } })
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
          membership.role !== 'OWNER' ||
          membership.status !== 'ACTIVE' ||
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
