import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { foodId } from '@pms/domain';
import { currentUserId } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { AssetImageError, processSiteImage } from '../marketing-site/asset-image';
import { SITE_ASSET_STORAGE, type SiteAssetStorage } from '../marketing-site/asset-storage';
import { MENU_VERTICALS, foodMay, foodScope, foodTransaction, foodWritable } from './scope';

/**
 * Фото блюда (DATA_MODEL §37, ADR-167): одно на блюдо. Хранилище и обработка как у фото объекта (`hotel/property-media`):
 * WebP в закрытом хранилище, в базе ключ. Замена удаляет прежний объект после записи; его сбой замену не откатывает.
 */
@Injectable()
export class MenuPhotoService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
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

  private itemId(raw: string) {
    try {
      return foodId(raw);
    } catch {
      throw new NotFoundException('Блюдо не найдено');
    }
  }

  async upload(idRaw: string, file: { buffer?: Buffer } | undefined) {
    foodMay('property');
    await foodWritable(this.prisma.db);
    const id = this.itemId(idRaw);
    if (!file?.buffer?.length) throw new BadRequestException('Выберите файл: JPEG, PNG или WebP');
    const storage = this.requireStorage();
    const s = await foodScope(this.prisma.db, MENU_VERTICALS);
    const item = await this.prisma.db.menuItem.findFirst({
      where: { id, businessId: s.businessId },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Блюдо не найдено');
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
    const key = `menu-photos/${s.businessId}/${id}/${processed.sha256}.webp`;
    const before = await this.prisma.db.menuItemPhoto.findUnique({ where: { menuItemId: id } });
    if (before?.storageRef === key) return { photoUrl: await storage.signedGet(key, 3600) };
    try {
      await storage.put({ key, body: processed.bytes, contentType: processed.mimeType });
    } catch {
      throw new ServiceUnavailableException({
        code: 'MEDIA_STORAGE_FAILED',
        message: 'Не удалось сохранить файл, повторите позже',
      });
    }
    const data = {
      storageRef: key,
      mimeType: processed.mimeType,
      byteSize: processed.byteSize,
      width: processed.width,
      height: processed.height,
      sha256: processed.sha256,
      createdById: currentUserId(),
    };
    let replaced: string | null;
    try {
      replaced = await foodTransaction(this.prisma, s, async (tx) => {
        const old = await tx.menuItemPhoto.findUnique({ where: { menuItemId: id } });
        await tx.menuItemPhoto.upsert({ where: { menuItemId: id }, create: { menuItemId: id, ...data }, update: data });
        await tx.auditLog.create({
          data: {
            organizationId: s.organizationId,
            userId: currentUserId(),
            entityType: 'menu_item',
            entityId: id,
            action: old ? 'food.menu.photo.replaced' : 'food.menu.photo.added',
            after: { byteSize: processed.byteSize, width: processed.width, height: processed.height },
          },
        });
        return old?.storageRef ?? null;
      }, MENU_VERTICALS);
    } catch (error) {
      await storage.delete(key).catch(() => undefined);
      throw error;
    }
    if (replaced && replaced !== key) await storage.delete(replaced).catch(() => undefined);
    return { photoUrl: await storage.signedGet(key, 3600) };
  }

  async remove(idRaw: string) {
    foodMay('property');
    await foodWritable(this.prisma.db);
    const id = this.itemId(idRaw);
    const s = await foodScope(this.prisma.db, MENU_VERTICALS);
    const ref = await foodTransaction(this.prisma, s, async (tx) => {
      const row = await tx.menuItemPhoto.findFirst({
        where: { menuItemId: id, menuItem: { businessId: s.businessId } },
      });
      if (!row) throw new NotFoundException('У блюда нет фото');
      await tx.menuItemPhoto.delete({ where: { menuItemId: id } });
      await tx.auditLog.create({
        data: {
          organizationId: s.organizationId,
          userId: currentUserId(),
          entityType: 'menu_item',
          entityId: id,
          action: 'food.menu.photo.removed',
          after: {},
        },
      });
      return row.storageRef;
    }, MENU_VERTICALS);
    await this.storage?.delete(ref).catch(() => undefined);
    return { deleted: true as const };
  }
}
