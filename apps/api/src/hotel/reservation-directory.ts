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
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { propertyIdRef, propertyToday } from '../database/property-ref';
export interface DirectoryQuery {
  from?: string;
  to?: string;
  status?: string;
  q?: string;
  page?: string;
  /** Сколько строк на странице, 1…200. По умолчанию 25 — как было до «Гостей на сегодня» */
  pageSize?: string;
}
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 200;
@Injectable()
export class ReservationDirectory {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async list(query: DirectoryQuery) {
    for (const key of ['from', 'to', 'status', 'q', 'page', 'pageSize'] as const) {
      if (query[key] !== undefined && typeof query[key] !== 'string')
        throw new BadRequestException('Параметры поиска должны быть строками');
    }
    // Без дат — «сегодня» по поясу объекта (С-13), а не по Алматы: справочник у каждой гостиницы свой
    const from = query.from || (await propertyToday(this.prisma.db, LUXX_APARTS_PROPERTY.name));
    const to = query.to || from;
    const valid = (date: string) =>
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      Number.isFinite(Date.parse(date)) &&
      new Date(date).toISOString().slice(0, 10) === date;
    const status = query.status || 'ALL';
    const page = Number(query.page || 1);
    // Потолок держит один запрос в берегах: на объекте 88 мест, больше 200 броней в сутках не бывает
    const pageSize = query.pageSize === undefined ? DEFAULT_PAGE_SIZE : Number(query.pageSize);
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
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE)
      throw new BadRequestException(`Размер страницы — целое число от 1 до ${MAX_PAGE_SIZE}`);
    const q = (query.q || '').trim();
    if (q.length > 120) throw new BadRequestException('Слишком длинный запрос');
    const property = await propertyIdRef(this.prisma.db, LUXX_APARTS_PROPERTY.name)
      .then((id) => ({ id }))
      .catch(() => null);
    if (!property) throw new NotFoundException('Гостиница ещё не настроена');
    // Отбор без статуса: по нему же считаются числа на чипах, чтобы «Проживают 3» было видно
    // до нажатия — смена не перебирает семь статусов вслепую (поручение владельца 21.09)
    const whereBase = {
      propertyId: property.id,
      arrivalDate: { lte: new Date(to) },
      departureDate: { gte: new Date(from) },
      ...(q
        ? {
            OR: [
              { confirmationNumber: { contains: q, mode: 'insensitive' as const } },
              // ADR-071: номер брони в канале стойка вводит без пробелов — так же и ищем
              { externalId: { contains: q.replace(/\s+/g, '') } },
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
    const where = {
      ...whereBase,
      ...(status !== 'ALL' ? { status: status as ReservationStatus } : {}),
    };
    const [total, rows, grouped] = await Promise.all([
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
      this.prisma.db.reservation.groupBy({
        by: ['status'],
        where: whereBase,
        _count: { _all: true },
      }),
    ]);
    const counts: Record<string, number> = { ALL: 0 };
    let all = 0;
    for (const g of grouped as { status: string; _count: { _all: number } }[]) {
      counts[g.status] = g._count._all;
      all += g._count._all;
    }
    counts['ALL'] = all;
    return {
      from,
      to,
      total,
      page,
      pageSize,
      counts,
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
