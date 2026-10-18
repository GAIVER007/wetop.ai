import { Buffer } from 'node:buffer';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpCode,
  Inject,
  Injectable,
  Post,
} from '@nestjs/common';
import {
  BeautyCustomerImportError,
  normalizeBeautyCustomerPhone,
  parseBeautyCustomerInput,
  parseBeautyCustomersCsv,
  type ImportedBeautyCustomer,
} from '@pms/domain';
import { Access } from '../auth/access.decorator';
import { BeautyAccess } from './access.decorator';
import { RequiresBusinessCapability } from '../auth/capability.decorator';
import { currentUserId } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { beautyScope, beautyTransaction, mayBeautyWrite } from './scope';
import { lockBeautyCustomerPhone, lockBeautyCustomerPhones } from './customer-identity';

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

function parsedCustomer(raw: unknown) {
  try {
    return parseBeautyCustomerInput(raw);
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

  async create(raw: unknown): Promise<Record<string, unknown>> {
    await mayBeautyWrite(this.prisma, 'desk');
    const scope = await beautyScope(this.prisma);
    const input = parsedCustomer(raw);
    return beautyTransaction(this.prisma, scope, async (tx) => {
      await lockBeautyCustomerPhone(tx, scope.organizationId, input.phone);
      const matches = await tx.customer.findMany({
        where: { organizationId: scope.organizationId, phone: { not: null } },
        orderBy: { id: 'asc' },
        select: { id: true, firstName: true, lastName: true, phone: true, status: true },
      });
      const normalizedMatches = matches.filter((customer) => normalizedExistingPhone(customer) === input.phone);
      if (normalizedMatches.some((customer) => customer.status !== 'ACTIVE' || fullName(customer) !== input.fullName)) {
        throw new ConflictException('Этот телефон уже принадлежит клиенту с другим именем');
      }
      const found = normalizedMatches[0];
      const customer = found ?? await tx.customer.create({
        data: {
          organizationId: scope.organizationId,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
        },
        select: { id: true, firstName: true, lastName: true, phone: true, status: true },
      });
      const linked = await tx.customerBusiness.createMany({
        data: [{ customerId: customer.id, businessId: scope.businessId }],
        skipDuplicates: true,
      });
      if (!found || linked.count > 0) {
        await tx.auditLog.create({
          data: {
            organizationId: scope.organizationId,
            userId: currentUserId(),
            entityType: 'customer',
            entityId: customer.id,
            action: found ? 'beauty.customer.linked' : 'beauty.customer.created',
            before: {},
            after: { source: 'manual', businessLinked: linked.count > 0 },
          },
        });
      }
      return customer;
    });
  }

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
  @Post()
  create(@Body() body: unknown) {
    return this.service.create(body);
  }

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
