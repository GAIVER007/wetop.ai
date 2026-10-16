import 'reflect-metadata';
import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SITE_ASSET_LIMITS } from '@pms/domain';
import { auditUserId } from '../accounts/actor';
import { PrismaService } from '../database/prisma.provider';
import { safeFileName } from '../hotel/property-media';
import { AssetImageError, processSiteImage } from '../marketing-site/asset-image';
import { SITE_ASSET_STORAGE, signedUrlTtl, type SiteAssetStorage } from '../marketing-site/asset-storage';
import { MARKETING_BUDGET_REPOSITORY, type MarketingBudgetRepository } from './marketing-budget.repository';

/**
 * Чеки и файлы расходов маркетинга (DATA_MODEL §51, ADR-MKT-B7, Q-MKT-FILES вариант А): то же закрытое хранилище и
 * та же обработка, что у фото объекта (§32.3). Фото хранится WebP без EXIF, PDF как есть. Браузер получает
 * подписанный адрес на время. Строки уходят вместе с расходом (CASCADE), объекты в хранилище остаются.
 */
export const EXPENSE_FILES_MAX = 10;
const MAX_BYTES = SITE_ASSET_LIMITS.maxUploadBytes;
const PDF_MAGIC = Buffer.from('%PDF-');

export interface ExpenseFileRow {
  id: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  storageRef: string;
}

export interface ExpenseFileView {
  id: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  /** Подписанный адрес на время; null: хранилище не включено */
  url: string | null;
}

const isUnique = (e: unknown) =>
  typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';

const UUID = /^[0-9a-f-]{36}$/i;

/** Подписанные адреса файлов для ответа «Бюджета»; без хранилища адреса нет */
export async function signFiles(storage: SiteAssetStorage | null, rows: ExpenseFileRow[]): Promise<ExpenseFileView[]> {
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      fileName: r.fileName,
      mimeType: r.mimeType,
      byteSize: r.byteSize,
      url: storage ? await storage.signedGet(r.storageRef, signedUrlTtl()) : null,
    })),
  );
}

@Injectable()
export class ExpenseFilesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MARKETING_BUDGET_REPOSITORY) private readonly repo: MarketingBudgetRepository,
    @Inject(SITE_ASSET_STORAGE) private readonly storage: SiteAssetStorage | null,
  ) {}

  private requireStorage(): SiteAssetStorage {
    if (!this.storage)
      throw new ServiceUnavailableException({
        code: 'MEDIA_STORAGE_OFF',
        message: 'Хранилище файлов не включено. Обратитесь в поддержку WETOP.',
      });
    return this.storage;
  }

  /** Расход своего филиала; чужой и несуществующий неразличимы: 404 */
  private async expenseOf(expenseId: string) {
    const scope = await this.repo.scope();
    await this.repo.assertWritable(scope.organizationId);
    if (!UUID.test(expenseId)) throw new NotFoundException('Расход не найден');
    const expense = await this.prisma.db.marketingExpense.findFirst({
      where: { id: expenseId.toLowerCase(), locationId: scope.locationId },
      select: { id: true, locationId: true },
    });
    if (!expense) throw new NotFoundException('Расход не найден');
    return expense;
  }

  /** Фото (JPEG, PNG, WebP → WebP без EXIF) или PDF; тот же файл к тому же расходу второй раз не ложится */
  private async prepare(file: { buffer?: Buffer; originalname?: string }) {
    const body = file.buffer!;
    if (body.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
      if (body.length > MAX_BYTES) throw new HttpException('Файл больше 10 МиБ', 413);
      return {
        bytes: body,
        mimeType: 'application/pdf',
        ext: 'pdf',
        byteSize: body.length,
        width: null,
        height: null,
        sha256: createHash('sha256').update(body).digest('hex'),
        fileName: safeFileName(file.originalname, 'Чек.pdf'),
      };
    }
    try {
      const image = await processSiteImage(body, 'IMAGE');
      return {
        bytes: image.bytes,
        mimeType: image.mimeType,
        ext: 'webp',
        byteSize: image.byteSize,
        width: image.width,
        height: image.height,
        sha256: image.sha256,
        fileName: safeFileName(file.originalname, 'Чек'),
      };
    } catch (error) {
      if (error instanceof AssetImageError)
        throw new HttpException(
          error.code === 'UNSUPPORTED_MEDIA_TYPE' ? 'Чек принимается фото (JPEG, PNG, WebP) или PDF' : error.message,
          error.code === 'FILE_TOO_LARGE' ? 413 : error.code === 'UNSUPPORTED_MEDIA_TYPE' ? 415 : 422,
        );
      throw error;
    }
  }

  async upload(expenseId: string, file: { buffer?: Buffer; originalname?: string } | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('Выберите файл: фото чека или PDF');
    const expense = await this.expenseOf(expenseId);
    const storage = this.requireStorage();
    const live = await this.prisma.db.marketingExpenseFile.count({ where: { expenseId: expense.id } });
    if (live >= EXPENSE_FILES_MAX)
      throw new BadRequestException(`Не больше ${EXPENSE_FILES_MAX} файлов на расход. Удалите лишние.`);
    const p = await this.prepare(file);
    const same = () =>
      this.prisma.db.marketingExpenseFile.findFirst({
        where: { expenseId: expense.id, sha256: p.sha256 },
        select: { id: true, fileName: true, mimeType: true, byteSize: true, storageRef: true },
      });
    const existing = await same();
    if (existing) return { file: (await signFiles(storage, [existing]))[0]!, created: false };
    const id = randomUUID();
    const key = `marketing-expense-files/${expense.locationId}/${id}/${p.sha256}.${p.ext}`;
    try {
      await storage.put({ key, body: p.bytes, contentType: p.mimeType });
    } catch {
      throw new ServiceUnavailableException({
        code: 'MEDIA_STORAGE_FAILED',
        message: 'Не удалось сохранить файл, повторите позже',
      });
    }
    try {
      const row = await this.prisma.db.$transaction(async (tx) => {
        const created = await tx.marketingExpenseFile.create({
          data: {
            id,
            expenseId: expense.id,
            locationId: expense.locationId,
            fileName: p.fileName,
            mimeType: p.mimeType,
            storageRef: key,
            byteSize: p.byteSize,
            width: p.width,
            height: p.height,
            sha256: p.sha256,
            createdById: auditUserId(),
          },
          select: { id: true, fileName: true, mimeType: true, byteSize: true, storageRef: true },
        });
        await tx.auditLog.create({
          data: {
            userId: auditUserId(),
            entityType: 'marketing_expense',
            entityId: expense.id,
            action: 'marketing_expense.file_added',
            after: { fileId: id, fileName: p.fileName, byteSize: p.byteSize, mimeType: p.mimeType },
          },
        });
        return created;
      });
      return { file: (await signFiles(storage, [row]))[0]!, created: true };
    } catch (error) {
      await storage.delete(key).catch(() => undefined);
      if (isUnique(error)) {
        const winner = await same();
        if (winner) return { file: (await signFiles(storage, [winner]))[0]!, created: false };
      }
      throw error;
    }
  }

  /** Удаление физическое с записью в журнал; объект в хранилище остаётся (§51), чек восстановим по журналу */
  async remove(expenseId: string, fileId: string): Promise<{ deleted: true }> {
    const expense = await this.expenseOf(expenseId);
    if (!UUID.test(fileId)) throw new NotFoundException('Файл не найден');
    await this.prisma.db.$transaction(async (tx) => {
      const row = await tx.marketingExpenseFile.findFirst({
        where: { id: fileId.toLowerCase(), expenseId: expense.id },
        select: { id: true, fileName: true, storageRef: true },
      });
      if (!row) throw new NotFoundException('Файл не найден');
      await tx.marketingExpenseFile.delete({ where: { id: row.id } });
      await tx.auditLog.create({
        data: {
          userId: auditUserId(),
          entityType: 'marketing_expense',
          entityId: expense.id,
          action: 'marketing_expense.file_removed',
          after: { fileId: row.id, fileName: row.fileName, storageRef: row.storageRef },
        },
      });
    });
    return { deleted: true };
  }
}
