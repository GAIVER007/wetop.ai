import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Inject,
  Injectable,
  Put,
} from '@nestjs/common';
import { parseWorkingHoursWeek, type WorkingInterval } from '@pms/domain';
import { Access } from '../auth/access.decorator';
import { BeautyAccess } from './access.decorator';
import { RequiresBusinessCapability } from '../auth/capability.decorator';
import { currentUserId, withServiceDatabase } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { beautyScope, beautyTransaction, mayBeauty, mayBeautyWrite } from './scope';
import { salonHours } from './location-hours-policy';

export interface BeautyLocationHoursResponse {
  location: { id: string; name: string | null; timezone: string };
  configured: boolean;
  revision: number;
  intervals: WorkingInterval[];
  conflicts: Array<{ id: string; startsAt: string; endsAt: string; customerName: string }>;
  conflictsTruncated: boolean;
}
@Injectable()
export class BeautyLocationHoursService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async get(): Promise<BeautyLocationHoursResponse> {
    mayBeauty('desk');
    const scope = await beautyScope(this.prisma, true);
    const locationId = scope.locationId!;
    const timezone = scope.locationTimezone!;
    const stored = await this.prisma.db.beautyLocationHours.findUnique({ where: { locationId } });
    const intervals = stored ? salonHours(stored.intervals) : [];
    const conflicts = stored
      ? await this.prisma.db.$queryRaw<
          Array<{ id: string; startsAt: Date; endsAt: Date; customerName: string }>
        >`
      SELECT a.id::text, a.starts_at AS "startsAt", a.ends_at AS "endsAt",
        concat_ws(' ',c.first_name,c.last_name) AS "customerName"
      FROM appointments a JOIN customers c ON c.id=a.customer_id
      WHERE a.location_id=${locationId}::uuid AND a.status::text IN ('BOOKED','CONFIRMED','IN_PROGRESS')
        AND a.ends_at > now()
        AND NOT beauty_time_in_hours(a.starts_at,a.ends_at,${timezone},${JSON.stringify(intervals)}::jsonb)
      ORDER BY a.starts_at,a.id LIMIT 101`
      : [];
    return {
      location: { id: locationId, name: scope.locationName, timezone },
      configured: stored !== null,
      revision: stored?.revision ?? 0,
      intervals,
      conflicts: conflicts
        .slice(0, 100)
        .map((row) => ({
          ...row,
          startsAt: row.startsAt.toISOString(),
          endsAt: row.endsAt.toISOString(),
        })),
      conflictsTruncated: conflicts.length > 100,
    };
  }
  async save(raw: unknown): Promise<BeautyLocationHoursResponse> {
    await mayBeautyWrite(this.prisma, 'property');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      throw new BadRequestException('Пришлите режим работы');
    const body = raw as Record<string, unknown>;
    if (
      Object.keys(body).some((key) => !['expectedRevision', 'intervals'].includes(key)) ||
      typeof body['expectedRevision'] !== 'number' ||
      !Number.isSafeInteger(body['expectedRevision']) ||
      body['expectedRevision'] < 0
    )
      throw new BadRequestException('Проверьте версию режима работы');
    const expectedRevision = body['expectedRevision'];
    const parsed = parseWorkingHoursWeek({ intervals: body['intervals'] });
    if (!parsed.ok) throw new BadRequestException('Проверьте режим работы салона: ' + parsed.reason);
    const intervals = salonHours(parsed.value).map((interval) => ({ ...interval }));
    const scope = await beautyScope(this.prisma, true);
    const locationId = scope.locationId!;
    await withServiceDatabase(() => beautyTransaction(this.prisma, scope, async (tx) => {
      const old = await tx.beautyLocationHours.findUnique({ where: { locationId } });
      if ((old?.revision ?? 0) !== expectedRevision)
        throw new ConflictException('Режим работы изменён. Обновите страницу перед сохранением.');
      if (old) {
        const saved = await tx.beautyLocationHours.updateMany({
          where: { locationId, revision: expectedRevision },
          data: { intervals, revision: { increment: 1 } },
        });
        if (saved.count !== 1)
          throw new ConflictException('Режим работы изменён. Обновите страницу.');
      } else await tx.beautyLocationHours.create({ data: { locationId, intervals, revision: 1 } });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId: currentUserId(),
          entityType: 'location',
          entityId: locationId,
          action: 'beauty.location_hours.updated',
          before: { intervals: old?.intervals ?? null, revision: old?.revision ?? 0 },
          after: { intervals, revision: expectedRevision + 1 },
        },
      });
    }));
    return this.get();
  }
}
@RequiresBusinessCapability('beauty.appointments')
@Controller('beauty/location-hours')
export class BeautyLocationHoursController {
  constructor(
    @Inject(BeautyLocationHoursService) private readonly service: BeautyLocationHoursService,
  ) {}
  @BeautyAccess('settings', 'view')
  @Get() @Access('desk') get() {
    return this.service.get();
  }
  @BeautyAccess('settings', 'update')
  @Put() @Access('property') save(@Body() body: unknown) {
    return this.service.save(body);
  }
}
