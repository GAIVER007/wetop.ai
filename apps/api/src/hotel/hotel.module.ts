import 'reflect-metadata';
import { ReservationDirectory, ReservationDirectoryController } from './reservation-directory';
import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Injectable,
  Module,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { ReservationStatus } from '@pms/database';
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';

/** Read-only projections of the approved model. No provider calls or financial mutations. */
@Injectable()
export class HotelService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async property() {
    const property = await this.prisma.db.property.findFirst({
      where: { name: LUXX_APARTS_PROPERTY.name },
      select: {
        id: true,
        name: true,
        legalName: true,
        address: true,
        timezone: true,
        currency: true,
        checkInTime: true,
        checkOutTime: true,
      },
    });
    if (!property) throw new NotFoundException('Гостиница ещё не настроена');
    return property;
  }

  async settings() {
    const property = await this.property();
    const ratePlans = await this.prisma.db.ratePlan.findMany({
      where: { propertyId: property.id },
      orderBy: { code: 'asc' },
      select: { code: true, name: true, currency: true, active: true, cancellationPenalty: true },
    });
    return { property, ratePlans };
  }

  async channelReport(from?: string, to?: string, status = 'ALL') {
    const validDate = (s?: string): s is string =>
      !!s &&
      /^\d{4}-\d{2}-\d{2}$/.test(s) &&
      Number.isFinite(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s;
    if (
      !validDate(from) ||
      !validDate(to) ||
      from > to ||
      (Date.parse(to) - Date.parse(from)) / 86400000 > 365
    ) {
      throw new BadRequestException('Выберите корректный период до 366 дней включительно');
    }
    if (
      status !== 'ALL' &&
      !Object.values(ReservationStatus).includes(status as ReservationStatus)
    ) {
      throw new BadRequestException('Неизвестный статус брони');
    }
    const property = await this.property();
    // Uses property/arrival index; DB aggregation avoids loading individual bookings or guests.
    const groups = await this.prisma.db.reservation.groupBy({
      by: ['source', 'channel', 'currency', 'status'],
      where: {
        propertyId: property.id,
        arrivalDate: { gte: new Date(from), lte: new Date(to) },
        ...(status !== 'ALL' ? { status: status as ReservationStatus } : {}),
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
    });
    const rows = new Map<
      string,
      {
        source: string;
        channel: string | null;
        currency: string;
        count: number;
        cancelled: number;
        noShow: number;
        amountMinor: bigint;
      }
    >();
    for (const group of groups) {
      const key = JSON.stringify([group.source, group.channel, group.currency]);
      const row = rows.get(key) ?? {
        source: group.source,
        channel: group.channel,
        currency: group.currency,
        count: 0,
        cancelled: 0,
        noShow: 0,
        amountMinor: 0n,
      };
      row.count += group._count._all;
      row.cancelled += group.status === 'CANCELLED' ? group._count._all : 0;
      row.noShow += group.status === 'NO_SHOW' ? group._count._all : 0;
      row.amountMinor += group._sum.totalAmount ?? 0n;
      rows.set(key, row);
    }
    return {
      from,
      to,
      status,
      dateBasis: 'ARRIVAL',
      rows: [...rows.values()]
        .sort(
          (a, b) =>
            b.count - a.count ||
            JSON.stringify([a.source, a.channel, a.currency]).localeCompare(
              JSON.stringify([b.source, b.channel, b.currency]),
            ),
        )
        .map((r) => ({ ...r, amountMinor: r.amountMinor.toString() })),
    };
  }
}

@Controller('hotel')
export class HotelController {
  constructor(@Inject(HotelService) private readonly service: HotelService) {}
  @Get('settings') settings() {
    return this.service.settings();
  }
  @Get('channel-report') channelReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    return this.service.channelReport(from, to, status);
  }
}

@Module({
  controllers: [HotelController, ReservationDirectoryController],
  providers: [PrismaService, HotelService, ReservationDirectory],
})
export class HotelModule {}
