import {
  Controller,
  Get,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Access } from '../auth/access.decorator';
import { BeautyAccess } from './access.decorator';
import { RequiresBusinessCapability } from '../auth/capability.decorator';
import { PrismaService } from '../database/prisma.provider';
import { beautyScope, mayBeauty } from './scope';

const HISTORY_LIMIT = 100;

export function beautyCustomerDetailWhere(id: string, organizationId: string, businessId: string) {
  return { id, organizationId, businesses: { some: { businessId } } };
}

export interface BeautyCustomerDetail {
  customer: {
    id: string;
    firstName: string;
    lastName: string | null;
    phone: string | null;
    email: string | null;
    notes: string | null;
    status: string;
    isVip: boolean;
    birthDate: string | null;
  };
  visits: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
    status: string;
    priceMinor: string;
    currency: string;
    source: string;
    location: { id: string; name: string; timezone: string };
    service: { id: string; name: string };
    employee: { id: string; name: string };
    lines: Array<{
      position: number;
      startsAt: string;
      endsAt: string;
      priceMinor: string;
      currency: string;
      service: { id: string; name: string };
      employee: { id: string; name: string };
    }>;
  }>;
  historyTruncated: boolean;
}

@Injectable()
export class BeautyCustomerDetailService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async detail(id: string): Promise<BeautyCustomerDetail> {
    mayBeauty('desk');
    const scope = await beautyScope(this.prisma);
    const customer = await this.prisma.db.customer.findFirst({
      where: beautyCustomerDetailWhere(id, scope.organizationId, scope.businessId),
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        notes: true,
        status: true,
        isVip: true,
        birthDate: true,
      },
    });
    if (!customer) throw new NotFoundException('Клиент не найден');
    const rows = await this.prisma.db.appointment.findMany({
      where: { customerId: id, location: { businessId: scope.businessId } },
      orderBy: [{ startsAt: 'desc' }, { id: 'asc' }],
      take: HISTORY_LIMIT + 1,
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        status: true,
        price: true,
        currency: true,
        source: true,
        location: { select: { id: true, name: true, timezone: true } },
        service: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true } },
        lines: {
          orderBy: { position: 'asc' },
          select: {
            position: true,
            startsAt: true,
            endsAt: true,
            priceMinor: true,
            currency: true,
            service: { select: { id: true, name: true } },
            employee: { select: { id: true, name: true } },
          },
        },
      },
    });
    return {
      customer: {
        ...customer,
        status: customer.status,
        birthDate: customer.birthDate?.toISOString().slice(0, 10) ?? null,
      },
      visits: rows.slice(0, HISTORY_LIMIT).map((row) => ({
        id: row.id,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        status: row.status,
        priceMinor: row.price.toString(),
        currency: row.currency,
        source: row.source,
        location: row.location,
        service: row.service,
        employee: row.employee,
        lines: row.lines.map((line) => ({
          position: line.position,
          startsAt: line.startsAt.toISOString(),
          endsAt: line.endsAt.toISOString(),
          priceMinor: line.priceMinor.toString(),
          currency: line.currency,
          service: line.service,
          employee: line.employee,
        })),
      })),
      historyTruncated: rows.length > HISTORY_LIMIT,
    };
  }
}

@RequiresBusinessCapability('beauty.customers')
@Access('desk')
@Controller('beauty/customers')
export class BeautyCustomerDetailController {
  constructor(
    @Inject(BeautyCustomerDetailService) private readonly service: BeautyCustomerDetailService,
  ) {}

  @BeautyAccess('customers', 'view')
  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.detail(id);
  }
}
