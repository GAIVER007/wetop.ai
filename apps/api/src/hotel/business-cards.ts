import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  ServiceUnavailableException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Prisma } from '@pms/database';
import {
  currentOrganizationId,
  currentRole,
  currentUserId,
  hasSignedInActor,
} from '../auth/request-context';
import { Access } from '../auth/access.decorator';
import { ScopeAware } from '../auth/scope-aware.decorator';
import { PrismaService } from '../database/prisma.provider';
import { AssetImageError, processSiteImage } from '../marketing-site/asset-image';
import {
  SITE_ASSET_STORAGE,
  siteAssetStorageFromEnv,
  signedUrlTtl,
  type SiteAssetStorage,
} from '../marketing-site/asset-storage';
const MAX_BYTES = 5 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Row = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  coverImage: Prisma.JsonValue;
  vertical: 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE';
  revision: string;
};
const ROW = Prisma.sql`id, organization_id AS "organizationId", name, description, cover_image AS "coverImage", vertical,
 to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS revision`;

type Cover = {
  storageRef: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  sha256: string;
};
function coverOf(value: Prisma.JsonValue): Cover | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (
    typeof value.storageRef !== 'string' ||
    typeof value.sha256 !== 'string' ||
    typeof value.mimeType !== 'string' ||
    typeof value.width !== 'number' ||
    typeof value.height !== 'number' ||
    typeof value.byteSize !== 'number'
  )
    return null;
  return value as unknown as Cover;
}
function inputOf(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new BadRequestException('Ожидается форма карточки');
  const body = raw as Record<string, unknown>;
  const allowed = ['name', 'description', 'expectedUpdatedAt', 'removeCover'];
  if (Object.keys(body).some((k) => !allowed.includes(k)))
    throw new BadRequestException('Лишние поля в карточке');
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (!name || name.length > 200) throw new BadRequestException('Название: от 1 до 200 символов');
  if (
    description.length > 1000 ||
    (body.description !== undefined && typeof body.description !== 'string')
  )
    throw new BadRequestException('Описание: не больше 1000 символов');
  if (
    typeof body.expectedUpdatedAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{1,6}Z$/.test(body.expectedUpdatedAt) ||
    !Number.isFinite(Date.parse(body.expectedUpdatedAt))
  )
    throw new BadRequestException('Обновите карточку перед сохранением');
  if (body.removeCover !== undefined && body.removeCover !== '0' && body.removeCover !== '1')
    throw new BadRequestException('Неверное значение удаления обложки');
  const revision = body.expectedUpdatedAt.replace(
    /\.(\d{1,6})Z$/,
    (_whole: string, fraction: string) => '.' + fraction.padEnd(6, '0') + 'Z',
  );
  return {
    name,
    description: description || null,
    revision,
    removeCover: body.removeCover === '1',
  };
}
@Injectable()
export class BusinessCardsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SITE_ASSET_STORAGE) private readonly storage: SiteAssetStorage | null,
  ) {}
  private organization() {
    const id = currentOrganizationId();
    if (!hasSignedInActor() || !id) throw new ForbiddenException('Войдите в организацию');
    return id;
  }
  private owner() {
    const organizationId = this.organization();
    if (currentRole() !== 'OWNER')
      throw new ForbiddenException('Карточку бизнеса изменяет владелец организации');
    return organizationId;
  }
  private async view(row: Row) {
    const cover = coverOf(row.coverImage);
    let coverUrl: string | null = null;
    if (cover && this.storage) {
      try {
        coverUrl = await this.storage.signedGet(cover.storageRef, signedUrlTtl());
      } catch {
        coverUrl = null;
      }
    }
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      vertical: row.vertical,
      coverUrl,
      hasCover: cover !== null,
      updatedAt: row.revision,
      canEdit: currentRole() === 'OWNER',
      canUpload: currentRole() === 'OWNER' && this.storage !== null,
    };
  }
  async list(visibleBusinessIds: string[], includeEmpty = false) {
    const organizationId = this.organization();
    const ids = [...new Set(visibleBusinessIds)];
    const owner = currentRole() === 'OWNER' && (includeEmpty || !ids.length);
    if (!ids.length && !owner) return [];
    const scope = owner
      ? Prisma.empty
      : Prisma.sql`AND id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})`;
    const rows = await this.prisma.db.$queryRaw<Row[]>(
      Prisma.sql`SELECT ${ROW} FROM businesses
        WHERE organization_id=${organizationId}::uuid AND status='ACTIVE' ${scope}
        AND (EXISTS (SELECT 1 FROM locations l WHERE l.business_id=businesses.id AND l.status='ACTIVE')
          OR NOT EXISTS (SELECT 1 FROM locations l WHERE l.business_id=businesses.id))
        ORDER BY name,id`,
    );
    return Promise.all(rows.map((row) => this.view(row)));
  }
  async save(id: string, raw: unknown, file?: { buffer?: Buffer }) {
    const organizationId = this.owner();
    if (!UUID.test(id)) throw new BadRequestException('Неверный бизнес');
    const input = inputOf(raw);
    const [existing] = await this.prisma.db.$queryRaw<Row[]>(
      Prisma.sql`SELECT ${ROW} FROM businesses WHERE id=${id}::uuid AND organization_id=${organizationId}::uuid AND status='ACTIVE'`,
    );
    if (!existing) throw new NotFoundException('Бизнес недоступен');
    if (existing.revision !== input.revision)
      throw new ConflictException('Карточка изменилась. Обновите страницу и повторите правки.');
    const buffer = file?.buffer?.length ? file.buffer : null;
    if (buffer && input.removeCover)
      throw new BadRequestException('Выберите замену фото или удаление обложки');
    let newCover: Cover | null = null;
    if (buffer) {
      if (buffer.length > MAX_BYTES)
        throw new HttpException('Фото должно быть не больше 5 МБ', 413);
      if (!this.storage) throw new ServiceUnavailableException('Хранилище фото не подключено');
      let image;
      try {
        image = await processSiteImage(buffer, 'IMAGE');
      } catch (error) {
        if (error instanceof AssetImageError)
          throw new HttpException(
            error.message,
            error.code === 'UNSUPPORTED_MEDIA_TYPE' ? 415 : 422,
          );
        throw error;
      }
      if (image.byteSize > MAX_BYTES) throw new HttpException('Обработанное фото больше 5 МБ', 422);
      const storageRef = `business-cards/${organizationId}/${id}/${randomUUID()}.webp`;
      await this.storage.put({ key: storageRef, body: image.bytes, contentType: image.mimeType });
      newCover = {
        storageRef,
        mimeType: image.mimeType,
        byteSize: image.byteSize,
        width: image.width,
        height: image.height,
        sha256: image.sha256,
      };
    }
    try {
      const row = await this.prisma.db.$transaction(async (tx) => {
        const coverChange = newCover
          ? Prisma.sql`cover_image=${JSON.stringify(newCover)}::jsonb,`
          : input.removeCover
            ? Prisma.sql`cover_image=NULL,`
            : Prisma.empty;
        const count = await tx.$executeRaw(
          Prisma.sql`UPDATE businesses SET name=${input.name}, description=${input.description}, ${coverChange} updated_at=clock_timestamp() WHERE id=${id}::uuid AND organization_id=${organizationId}::uuid AND status='ACTIVE' AND updated_at=${input.revision}::timestamptz`,
        );
        if (count !== 1)
          throw new ConflictException('Карточка изменилась. Обновите страницу и повторите правки.');
        await tx.auditLog.create({
          data: {
            organizationId,
            userId: currentUserId(),
            entityType: 'business',
            entityId: id,
            action: 'business.card_updated',
            before: {
              name: existing.name,
              description: existing.description,
              hasCover: coverOf(existing.coverImage) !== null,
            },
            after: {
              name: input.name,
              description: input.description,
              coverChanged: !!newCover || input.removeCover,
              ...(newCover
                ? { coverSha256: newCover.sha256, width: newCover.width, height: newCover.height }
                : {}),
            },
          },
        });
        const [saved] = await tx.$queryRaw<Row[]>(
          Prisma.sql`SELECT ${ROW} FROM businesses WHERE id=${id}::uuid AND organization_id=${organizationId}::uuid`,
        );
        if (!saved) throw new NotFoundException('Бизнес недоступен');
        return saved;
      });
      return await this.view(row);
    } catch (error) {
      if (newCover && this.storage) {
        try {
          await this.storage.delete(newCover.storageRef);
        } catch {
          console.warn(
            JSON.stringify({
              event: 'business_card.upload_cleanup_failed',
              businessId: id,
              sha256: newCover.sha256,
            }),
          );
        }
      }
      throw error;
    }
  }
}
@Controller('branches/businesses')
export class BusinessCardsController {
  constructor(@Inject(BusinessCardsService) private readonly service: BusinessCardsService) {}
  @Access('owner')
  @ScopeAware()
  @Post(':id/card')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_BYTES, files: 1, fields: 4 } }),
  )
  save(
    @Param('id') id: string,
    @Body() body: unknown,
    @UploadedFile() file: { buffer?: Buffer } | undefined,
  ) {
    return this.service.save(id, body, file);
  }
}
@Module({
  controllers: [BusinessCardsController],
  providers: [
    BusinessCardsService,
    PrismaService,
    { provide: SITE_ASSET_STORAGE, useFactory: () => siteAssetStorageFromEnv() },
  ],
  exports: [BusinessCardsService],
})
export class BusinessCardsModule {}
