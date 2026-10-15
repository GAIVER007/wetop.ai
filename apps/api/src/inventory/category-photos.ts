import 'reflect-metadata';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  Put,
} from '@nestjs/common';
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { propertyIdRef } from '../database/property-ref';
import { auditUserId } from '../accounts/actor';
import { Access } from '../auth/access.decorator';
import { RequiresBusinessCapability } from '../auth/capability.decorator';
import {
  SITE_ASSET_STORAGE,
  signedUrlTtl,
  type SiteAssetStorage,
} from '../marketing-site/asset-storage';

/** Не больше десяти фото у категории (DATA_MODEL §30.1, CHECK position 0..9) */
export const MAX_CATEGORY_PHOTOS = 10;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CategoryPhotoView {
  assetId: string;
  /** Подписанный адрес библиотеки; null, когда хранилище не настроено */
  url: string | null;
  alt: string | null;
  width: number;
  height: number;
}

/** Тело PUT: порядок фото категории, строго список uuid без повторов */
export function photoIdsInput(body: unknown): string[] {
  const raw = (body as { assetIds?: unknown } | null)?.assetIds;
  if (!Array.isArray(raw)) throw new BadRequestException('assetIds: список изображений');
  if (raw.length > MAX_CATEGORY_PHOTOS)
    throw new BadRequestException(`Не больше ${MAX_CATEGORY_PHOTOS} фото у категории`);
  const ids = raw.map((v) => (typeof v === 'string' ? v.toLowerCase() : ''));
  if (ids.some((id) => !UUID.test(id)))
    throw new BadRequestException('assetIds: идентификатор изображения неверен');
  if (new Set(ids).size !== ids.length)
    throw new BadRequestException('Одно и то же фото нельзя выбрать дважды');
  return ids;
}

@Injectable()
export class CategoryPhotos {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SITE_ASSET_STORAGE) private readonly storage: SiteAssetStorage | null,
  ) {}

  /** Фото всех категорий объекта по коду категории; удалённые и неготовые изображения не показываются */
  async list(): Promise<Record<string, CategoryPhotoView[]>> {
    const propertyId = await propertyIdRef(this.prisma.db, LUXX_APARTS_PROPERTY.name);
    const rows = await this.prisma.db.accommodationTypePhoto.findMany({
      where: { accommodationType: { propertyId }, siteAsset: { status: 'READY' } },
      orderBy: [{ accommodationTypeId: 'asc' }, { position: 'asc' }],
      select: {
        accommodationType: { select: { code: true } },
        siteAsset: {
          select: { id: true, storageRef: true, defaultAlt: true, width: true, height: true },
        },
      },
    });
    const out: Record<string, CategoryPhotoView[]> = {};
    for (const row of rows) {
      const alt = (row.siteAsset.defaultAlt as Record<string, string> | null)?.ru ?? null;
      (out[row.accommodationType.code] ??= []).push({
        assetId: row.siteAsset.id,
        url: this.storage
          ? await this.storage.signedGet(row.siteAsset.storageRef, signedUrlTtl())
          : null,
        alt,
        width: row.siteAsset.width,
        height: row.siteAsset.height,
      });
    }
    return out;
  }

  /** Заменяет выбор фото категории целиком, порядок как в списке */
  async set(code: string, body: unknown): Promise<{ count: number }> {
    const ids = photoIdsInput(body);
    const propertyId = await propertyIdRef(this.prisma.db, LUXX_APARTS_PROPERTY.name);
    return this.prisma.db.$transaction(async (tx) => {
      const type = await tx.accommodationType.findFirst({
        where: { code, propertyId },
        select: { id: true, property: { select: { locationId: true } } },
      });
      if (!type) throw new NotFoundException('Категория не найдена');
      if (ids.length) {
        const found = await tx.siteAsset.findMany({
          where: {
            id: { in: ids },
            status: 'READY',
            kind: 'IMAGE',
            locationId: type.property.locationId ?? '00000000-0000-0000-0000-000000000000',
          },
          select: { id: true },
        });
        if (found.length !== ids.length)
          throw new BadRequestException(
            'Фото нет в библиотеке филиала или оно не готово. Загрузите его в «Маркетинг → Изображения сайта».',
          );
      }
      const before = await tx.accommodationTypePhoto.findMany({
        where: { accommodationTypeId: type.id },
        orderBy: { position: 'asc' },
        select: { siteAssetId: true },
      });
      await tx.accommodationTypePhoto.deleteMany({ where: { accommodationTypeId: type.id } });
      if (ids.length)
        await tx.accommodationTypePhoto.createMany({
          data: ids.map((siteAssetId, position) => ({
            accommodationTypeId: type.id,
            siteAssetId,
            position,
          })),
        });
      await tx.auditLog.create({
        data: {
          userId: auditUserId(),
          action: 'inventory.category.photos_set',
          entityType: 'accommodation_type',
          entityId: type.id,
          before: { assetIds: before.map((b) => b.siteAssetId) },
          after: { assetIds: ids, propertyId },
        },
      });
      return { count: ids.length };
    });
  }
}

/** Чтение для панели места: любой, кто видит фонд */
@Access('desk')
@RequiresBusinessCapability('hospitality.inventory')
@Controller('inventory')
export class CategoryPhotosReadController {
  constructor(@Inject(CategoryPhotos) private readonly photos: CategoryPhotos) {}
  @Get('photos') list() {
    return this.photos.list();
  }
}

/** Выбор фото правит тот, кто правит категории */
@Access('property')
@Controller('inventory')
export class CategoryPhotosController {
  constructor(@Inject(CategoryPhotos) private readonly photos: CategoryPhotos) {}
  @Put('categories/:code/photos') set(@Param('code') code: string, @Body() body: unknown) {
    return this.photos.set(code, body);
  }
}
