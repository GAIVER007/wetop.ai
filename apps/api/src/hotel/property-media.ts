import 'reflect-metadata';
import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Module,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  Post,
  ServiceUnavailableException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Prisma } from '@pms/database';
import { SITE_ASSET_LIMITS, accessDeniedMessage } from '@pms/domain';
import { Access } from '../auth/access.decorator';
import { actorMay, hasSignedInActor } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { AssetImageError, processSiteImage } from '../marketing-site/asset-image';
import {
  SITE_ASSET_STORAGE,
  siteAssetStorageFromEnv,
  signedUrlTtl,
  type SiteAssetStorage,
} from '../marketing-site/asset-storage';
import { HotelService } from './hotel.module';

/**
 * Фото и договор объекта (ADR-155, DATA_MODEL §31.3, Q-287 вариант А). Те же закрытое хранилище и обработка изображений,
 * что у библиотеки сайта, но без лицензии конструктора: это сведения объекта, а не сайта. В базе только ключ объекта,
 * браузер получает подписанный адрес на время. Правят владелец и управляющий (право `settings`); читают все
 * вошедшие, но договор отдаётся только с правом `settings`.
 */
export const PHOTOS_MAX = 20;
const MAX_BYTES = SITE_ASSET_LIMITS.maxUploadBytes;
const PDF_MAGIC = Buffer.from('%PDF-');

const ROW = {
  id: true,
  kind: true,
  position: true,
  fileName: true,
  mimeType: true,
  storageRef: true,
  byteSize: true,
  width: true,
  height: true,
  alt: true,
  createdAt: true,
} as const;
type Row = Prisma.PropertyMediaGetPayload<{ select: typeof ROW }>;

const isUnique = (e: unknown) =>
  typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';

/** Имя файла для показа: без пути и управляющих знаков, не длиннее 200 */
export function safeFileName(raw: unknown): string {
  const base = String(raw ?? '')
    .split(/[\\/]/)
    .pop()!
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return (base || 'Договор.pdf').slice(-200);
}

@Injectable()
export class PropertyMediaService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(HotelService) private readonly hotel: HotelService,
    @Inject(SITE_ASSET_STORAGE) private readonly storage: SiteAssetStorage | null,
  ) {}

  private mayWrite() {
    if (!hasSignedInActor() || !actorMay('settings'))
      throw new ForbiddenException(accessDeniedMessage('settings'));
  }

  private requireStorage(): SiteAssetStorage {
    if (!this.storage)
      throw new ServiceUnavailableException({
        code: 'MEDIA_STORAGE_OFF',
        message: 'Хранилище файлов не включено. Обратитесь в поддержку WETOP.',
      });
    return this.storage;
  }

  private async view(row: Row) {
    return {
      id: row.id,
      kind: row.kind as 'PHOTO' | 'CONTRACT',
      position: row.position,
      fileName: row.fileName,
      byteSize: row.byteSize,
      width: row.width,
      height: row.height,
      alt: row.alt,
      createdAt: row.createdAt,
      url: this.storage ? await this.storage.signedGet(row.storageRef, signedUrlTtl()) : null,
    };
  }

  async list() {
    const propertyId = await this.hotel.currentPropertyId();
    const rows = await this.prisma.db.propertyMedia.findMany({
      where: { propertyId, deletedAt: null },
      orderBy: [{ kind: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }],
      select: ROW,
    });
    const may = hasSignedInActor() && actorMay('settings');
    const photos = await Promise.all(rows.filter((r) => r.kind === 'PHOTO').map((r) => this.view(r)));
    const contractRow = rows.find((r) => r.kind === 'CONTRACT');
    return {
      storage: this.storage ? ('READY' as const) : ('OFF' as const),
      limits: { maxBytes: MAX_BYTES, maxPhotos: PHOTOS_MAX },
      photos,
      contract: contractRow && may ? await this.view(contractRow) : null,
    };
  }

  private async audit(
    tx: Pick<PrismaService['db'], 'auditLog'>,
    propertyId: string,
    action: string,
    after: Prisma.InputJsonObject,
  ) {
    await tx.auditLog.create({
      data: { entityType: 'Property', entityId: propertyId, action, before: Prisma.DbNull, after },
    });
  }

  async uploadPhoto(file: { buffer?: Buffer } | undefined) {
    this.mayWrite();
    if (!file?.buffer?.length) throw new BadRequestException('Выберите файл: JPEG, PNG или WebP');
    const storage = this.requireStorage();
    const propertyId = await this.hotel.currentPropertyId();
    const live = await this.prisma.db.propertyMedia.count({
      where: { propertyId, kind: 'PHOTO', deletedAt: null },
    });
    if (live >= PHOTOS_MAX)
      throw new BadRequestException(`Не больше ${PHOTOS_MAX} фото на объект. Удалите лишние.`);
    let processed;
    try {
      processed = await processSiteImage(file.buffer, 'IMAGE');
    } catch (error) {
      if (error instanceof AssetImageError)
        throw new HttpException(
          error.message,
          error.code === 'FILE_TOO_LARGE' ? 413 : error.code === 'UNSUPPORTED_MEDIA_TYPE' ? 415 : 422,
        );
      throw error;
    }
    const same = () =>
      this.prisma.db.propertyMedia.findFirst({
        where: { propertyId, kind: 'PHOTO', sha256: processed.sha256, deletedAt: null },
        select: ROW,
      });
    const existing = await same();
    if (existing) return { photo: await this.view(existing), created: false };
    const id = randomUUID();
    const key = `property-media/${propertyId}/${id}/${processed.sha256}.webp`;
    await this.put(storage, key, processed.bytes, processed.mimeType);
    try {
      const row = await this.prisma.db.$transaction(async (tx) => {
        const last = await tx.propertyMedia.aggregate({
          where: { propertyId, kind: 'PHOTO', deletedAt: null },
          _max: { position: true },
        });
        const created = await tx.propertyMedia.create({
          data: {
            id,
            propertyId,
            kind: 'PHOTO',
            position: (last._max.position ?? -1) + 1,
            mimeType: processed.mimeType,
            storageRef: key,
            byteSize: processed.byteSize,
            width: processed.width,
            height: processed.height,
            sha256: processed.sha256,
          },
          select: ROW,
        });
        await this.audit(tx, propertyId, 'hotel.media.photo.added', {
          mediaId: id,
          byteSize: processed.byteSize,
        });
        return created;
      });
      return { photo: await this.view(row), created: true };
    } catch (error) {
      await storage.delete(key).catch(() => undefined);
      if (isUnique(error)) {
        const winner = await same();
        if (winner) return { photo: await this.view(winner), created: false };
      }
      throw error;
    }
  }

  async removePhoto(id: string) {
    this.mayWrite();
    return this.remove(id, 'PHOTO');
  }

  async uploadContract(file: { buffer?: Buffer; originalname?: string } | undefined) {
    this.mayWrite();
    const body = file?.buffer;
    if (!body?.length) throw new BadRequestException('Выберите файл договора в формате PDF');
    if (body.length > MAX_BYTES) throw new HttpException('Файл больше 10 МиБ', 413);
    if (!body.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC))
      throw new HttpException('Договор принимается только в формате PDF', 415);
    const storage = this.requireStorage();
    const propertyId = await this.hotel.currentPropertyId();
    const sha256 = createHash('sha256').update(body).digest('hex');
    const id = randomUUID();
    const key = `property-media/${propertyId}/${id}/${sha256}.pdf`;
    await this.put(storage, key, body, 'application/pdf');
    try {
      const row = await this.prisma.db.$transaction(async (tx) => {
        // новый договор заменяет прежний: прежний получает deleted_at, объект остаётся в хранилище
        await tx.propertyMedia.updateMany({
          where: { propertyId, kind: 'CONTRACT', deletedAt: null },
          data: { deletedAt: new Date() },
        });
        const created = await tx.propertyMedia.create({
          data: {
            id,
            propertyId,
            kind: 'CONTRACT',
            fileName: safeFileName(file?.originalname),
            mimeType: 'application/pdf',
            storageRef: key,
            byteSize: body.length,
            sha256,
          },
          select: ROW,
        });
        await this.audit(tx, propertyId, 'hotel.media.contract.replaced', {
          mediaId: id,
          byteSize: body.length,
        });
        return created;
      });
      return { contract: await this.view(row) };
    } catch (error) {
      await storage.delete(key).catch(() => undefined);
      throw error;
    }
  }

  async removeContract() {
    this.mayWrite();
    const propertyId = await this.hotel.currentPropertyId();
    const row = await this.prisma.db.propertyMedia.findFirst({
      where: { propertyId, kind: 'CONTRACT', deletedAt: null },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Договор не загружен');
    return this.remove(row.id, 'CONTRACT');
  }

  private async remove(id: string, kind: 'PHOTO' | 'CONTRACT') {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new NotFoundException('Файл не найден');
    const propertyId = await this.hotel.currentPropertyId();
    await this.prisma.db.$transaction(async (tx) => {
      const row = await tx.propertyMedia.findFirst({
        where: { id: id.toLowerCase(), propertyId, kind, deletedAt: null },
        select: { id: true },
      });
      if (!row) throw new NotFoundException('Файл не найден');
      await tx.propertyMedia.update({ where: { id: row.id }, data: { deletedAt: new Date() } });
      await this.audit(
        tx,
        propertyId,
        kind === 'PHOTO' ? 'hotel.media.photo.removed' : 'hotel.media.contract.removed',
        { mediaId: row.id },
      );
    });
    return { deleted: true as const };
  }

  private async put(storage: SiteAssetStorage, key: string, body: Buffer, contentType: string) {
    try {
      await storage.put({ key, body, contentType });
    } catch {
      throw new ServiceUnavailableException({
        code: 'MEDIA_STORAGE_FAILED',
        message: 'Не удалось сохранить файл, повторите позже',
      });
    }
  }
}

const upload = () =>
  FileInterceptor('file', { limits: { fileSize: MAX_BYTES, files: 1, fields: 2, parts: 4 } });

@Controller('hotel/media')
export class PropertyMediaController {
  constructor(@Inject(PropertyMediaService) private readonly media: PropertyMediaService) {}

  @Access('desk')
  @Get()
  list() {
    return this.media.list();
  }

  @Access('settings')
  @Post('photos')
  @HttpCode(201)
  @UseInterceptors(upload())
  uploadPhoto(@UploadedFile() file: { buffer?: Buffer } | undefined) {
    return this.media.uploadPhoto(file);
  }

  @Access('settings')
  @Delete('photos/:id')
  removePhoto(@Param('id') id: string) {
    return this.media.removePhoto(id);
  }

  @Access('settings')
  @Post('contract')
  @HttpCode(201)
  @UseInterceptors(upload())
  uploadContract(@UploadedFile() file: { buffer?: Buffer; originalname?: string } | undefined) {
    return this.media.uploadContract(file);
  }

  @Access('settings')
  @Delete('contract')
  removeContract() {
    return this.media.removeContract();
  }
}

@Module({
  controllers: [PropertyMediaController],
  providers: [
    PrismaService,
    HotelService,
    PropertyMediaService,
    { provide: SITE_ASSET_STORAGE, useFactory: () => siteAssetStorageFromEnv() },
  ],
})
export class PropertyMediaModule {}
