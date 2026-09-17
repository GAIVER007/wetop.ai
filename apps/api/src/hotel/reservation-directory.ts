import 'reflect-metadata';
import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Injectable,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { ReservationStatus } from '@pms/database';
import { folioBalance } from '@pms/domain';
import { LUXX_APARTS_PROPERTY } from '@pms/imports';
import { PrismaService } from '../database/prisma.provider';
export interface DirectoryQuery {
  from?: string;
  to?: string;
  status?: string;
  q?: string;
  page?: string;
  /** Сколько строк на странице, 1…200. По умолчанию 25 — как было до «Гостей на сегодня» */
  pageSize?: string;
}
@Injectable()
export class ReservationDirectory {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async list(query: DirectoryQuery) {
    for (const key of ['from', 'to', 'status', 'q', 'page', 'pageSize'] as const) {
      if (query[key] !== undefined && typeof query[key] !== 'string')
        throw new BadRequestException('Параметры поиска должны быть строками');
    }
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date());
    const from = query.from || today;
    const to = query.to || from;
    const valid = (date: string) =>
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      Number.isFinite(Date.parse(date)) &&
      new Date(date).toISOString().slice(0, 10) === date;
    const status = query.status || 'ALL';
    const page = Number(query.page || 1);
    // Потолок держит один запрос в берегах: на объекте 88 мест, больше 200 броней в сутках не бывает
    const pageSize = Number(query.pageSize || 25);
    if (
      !valid(from) ||
      !valid(to) ||
      from > to ||
      Date.parse(to) - Date.parse(from) > 365 * 86400000
    )
      throw new BadRequestException('Выберите период до 366 дней');
    if (status !== 'ALL' && !Object.values(ReservationStatus).includes(status as ReservationStatus))
      throw new BadRequestException('Неизвестный статус');
    if (!Number.isInteger(page) || page < 1 || page > 10000)
      throw new BadRequestException('Некорректная страница');
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 200)
      throw new BadRequestException('Размер страницы — целое число от 1 до 200');
    const q = (query.q || '').trim();
    if (q.length > 120) throw new BadRequestException('Слишком длинный запрос');
    const property = await this.prisma.db.property.findFirst({
      where: { name: LUXX_APARTS_PROPERTY.name },
      select: { id: true },
    });
    if (!property) throw new NotFoundException('Гостиница ещё не настроена');
    const where = {
      propertyId: property.id,
      arrivalDate: { lte: new Date(to) },
      departureDate: { gte: new Date(from) },
      ...(status !== 'ALL' ? { status: status as ReservationStatus } : {}),
      ...(q
        ? {
            OR: [
              { confirmationNumber: { contains: q, mode: 'insensitive' as const } },
              {
                primaryGuest: {
                  is: {
                    OR: [
                      { firstName: { contains: q, mode: 'insensitive' as const } },
                      { lastName: { contains: q, mode: 'insensitive' as const } },
                      { phone: { contains: q } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.db.reservation.count({ where }),
      this.prisma.db.reservation.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ arrivalDate: 'desc' }, { id: 'asc' }],
        select: {
          confirmationNumber: true,
          status: true,
          source: true,
          channel: true,
          arrivalDate: true,
          departureDate: true,
          currency: true,
          totalAmount: true,
          primaryGuest: {
            select: { id: true, firstName: true, lastName: true, phone: true, email: true },
          },
          items: {
            select: {
              allocations: {
                orderBy: { startDate: 'desc' },
                take: 1,
                select: { inventoryUnit: { select: { code: true } } },
              },
              folio: {
                select: {
                  charges: { where: { voidedAt: null }, select: { amount: true } },
                  allocations: {
                    where: { payment: { status: 'COMPLETED' } },
                    select: { amount: true },
                  },
                  refunds: { select: { amount: true } },
                },
              },
            },
          },
        },
      }),
    ]);
    return {
      from,
      to,
      total,
      page,
      pageSize,
      rows: rows.map((r) => {
        const folios = r.items.flatMap((it) => (it.folio ? [it.folio] : []));
        const balance = folioBalance({
          charges: folios.flatMap((f) =>
            f.charges.map((c) => ({ amountMinor: c.amount, voided: false })),
          ),
          allocations: folios.flatMap((f) => f.allocations.map((a) => ({ amountMinor: a.amount }))),
          refunds: folios.flatMap((f) => f.refunds.map((a) => ({ amountMinor: a.amount }))),
        });
        return {
          confirmationNumber: r.confirmationNumber,
          status: r.status,
          source: r.source,
          channel: r.channel,
          arrivalDate: r.arrivalDate.toISOString().slice(0, 10),
          departureDate: r.departureDate.toISOString().slice(0, 10),
          currency: r.currency,
          totalAmountMinor: r.totalAmount.toString(),
          primaryGuest: r.primaryGuest
            ? {
                id: r.primaryGuest.id,
                label: `${r.primaryGuest.firstName} ${r.primaryGuest.lastName}`.trim(),
                phone: r.primaryGuest.phone,
                email: r.primaryGuest.email,
              }
            : null,
          unitCodes: r.items.flatMap((it) => it.allocations.map((a) => a.inventoryUnit.code)),
          paidMinor: balance.paidMinor.toString(),
          balanceMinor: balance.balanceMinor.toString(),
          hasFolios: folios.length > 0,
        };
      }),
    };
  }
}
@Controller('hotel/reservations')
export class ReservationDirectoryController {
  constructor(@Inject(ReservationDirectory) private readonly service: ReservationDirectory) {}
  @Get() list(@Query() query: DirectoryQuery) {
    return this.service.list(query);
  }
}
