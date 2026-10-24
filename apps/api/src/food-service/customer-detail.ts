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
import { RequiresBusinessCapability } from '../auth/capability.decorator';
import { PrismaService } from '../database/prisma.provider';
import { foodMay, foodScope } from './scope';

/**
 * Карточка клиента ресторана (решение владельца 23.10.2026 п. 4, план `plans/2026-10-23-vertical-unification.md`
 * срез 5): клиент своей организации и своего бизнеса и его брони столов во всех филиалах бизнеса, как история визитов
 * салона (`beauty/customer-detail.ts`). Только чтение, без новых полей и миграций.
 *
 * Суммы в истории нет: заказ ресторана (`restaurant_orders`) с клиентом и бронью в модели не связан (DATA_MODEL §33),
 * поэтому сумму визита честно не показываем, а не подбираем заказ по столу и времени (Q-FOOD-CUSTOMER-1).
 */
const HISTORY_LIMIT = 100;

export interface FoodCustomerDetail {
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
    partySize: number;
    status: string;
    source: string;
    notes: string | null;
    location: { id: string; name: string; timezone: string };
    table: { name: string; areaName: string } | null;
  }>;
  historyTruncated: boolean;
}

@Injectable()
export class FoodCustomerDetailService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async detail(id: string): Promise<FoodCustomerDetail> {
    foodMay('desk');
    const scope = await foodScope(this.prisma.db);
    const customer = await this.prisma.db.customer.findFirst({
      where: { id, organizationId: scope.organizationId, businesses: { some: { businessId: scope.businessId } } },
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
    const rows = await this.prisma.db.restaurantReservation.findMany({
      where: { customerId: id, location: { businessId: scope.businessId } },
      orderBy: [{ startsAt: 'desc' }, { id: 'asc' }],
      take: HISTORY_LIMIT + 1,
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        partySize: true,
        status: true,
        source: true,
        notes: true,
        location: { select: { id: true, name: true, timezone: true } },
        tableAssignment: { select: { table: { select: { name: true, area: { select: { name: true } } } } } },
      },
    });
    return {
      customer: { ...customer, birthDate: customer.birthDate?.toISOString().slice(0, 10) ?? null },
      visits: rows.slice(0, HISTORY_LIMIT).map((row) => ({
        id: row.id,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        partySize: row.partySize,
        status: row.status,
        source: row.source,
        notes: row.notes,
        location: row.location,
        table: row.tableAssignment
          ? { name: row.tableAssignment.table.name, areaName: row.tableAssignment.table.area.name }
          : null,
      })),
      historyTruncated: rows.length > HISTORY_LIMIT,
    };
  }
}

@Controller('food-service/customers')
@Access('desk')
@RequiresBusinessCapability('food.tableReservations')
export class FoodCustomerDetailController {
  constructor(@Inject(FoodCustomerDetailService) private readonly service: FoodCustomerDetailService) {}

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.detail(id);
  }
}
