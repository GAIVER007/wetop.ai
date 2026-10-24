import { BadRequestException, Body, Controller, Get, Inject, Injectable, Put } from '@nestjs/common';
import {
  assertBranchPaymentMethodEnabled,
  enabledPaymentMethods,
  parseBranchPaymentMethodSettings,
  resolveBranchPaymentMethodSettings,
  type PaymentMethodSetting,
} from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import type { DbTx } from '@pms/database';
import { Access } from '../auth/access.decorator';
import { BeautyAccess } from '../beauty/access.decorator';
import { RequiresBusinessCapability } from '../auth/capability.decorator';
import { currentUserId } from '../auth/request-context';
import { BRANCH_CASH_VERTICALS, foodMay, foodScope, foodTransaction, foodWritable } from './scope';

/**
 * Способы оплаты филиала салона и ресторана (DATA_MODEL §21.7, миграция 151, решение владельца 23.10.2026): какие из
 * шести денежных способов кассы филиала принимаются и в каком порядке. Строк нет: все шесть включены.
 */
type Reader = Pick<DbTx, 'branchPaymentMethodSetting'>;

export async function branchPaymentSettings(db: Reader, locationId: string): Promise<PaymentMethodSetting[]> {
  const rows = await db.branchPaymentMethodSetting.findMany({
    where: { locationId },
    orderBy: { sortOrder: 'asc' },
    select: { method: true, enabled: true, sortOrder: true },
  });
  return resolveBranchPaymentMethodSettings(rows);
}

/**
 * Правило У5 филиала в транзакции записи денег: выключенный способ не принимает новых денег. Зовут оплата заказа и
 * записи, приход и перевод кассы, выплата зарплаты, продажа сертификата и бара. Возврат, расход и перевод «из»
 * способа не проверяются: деньги, пришедшие раньше, должны уходить из кассы и после выключения.
 */
export async function assertBranchMethodsOpen(db: Reader, locationId: string, ...methods: Array<string | null | undefined>) {
  const enabled = enabledPaymentMethods(await branchPaymentSettings(db, locationId));
  for (const method of methods) {
    if (!method) continue;
    try {
      assertBranchPaymentMethodEnabled(method, enabled);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }
}

@Injectable()
export class BranchPaymentMethodsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Список филиала: читает стойка (формы приёма денег), правят владелец и управляющий */
  async get(): Promise<{ methods: PaymentMethodSetting[] }> {
    foodMay('desk');
    const s = await foodScope(this.prisma.db, BRANCH_CASH_VERTICALS);
    return { methods: await branchPaymentSettings(this.prisma.db, s.locationId) };
  }

  /** Сохранение: все шесть строк одной транзакцией, порядок это позиция в списке; журнал «было/стало» */
  async update(raw: unknown): Promise<{ methods: PaymentMethodSetting[] }> {
    foodMay('settings');
    await foodWritable(this.prisma.db);
    const parsed = parseBranchPaymentMethodSettings(raw);
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const next = parsed.value;
    const s = await foodScope(this.prisma.db, BRANCH_CASH_VERTICALS);
    return foodTransaction(
      this.prisma,
      s,
      async (tx) => {
        const current = await branchPaymentSettings(tx, s.locationId);
        const snapshot = (list: PaymentMethodSetting[]) => ({
          enabled: enabledPaymentMethods(list),
          order: list.map((m) => m.method),
        });
        const before = snapshot(current);
        const after = snapshot(next);
        if (JSON.stringify(before) === JSON.stringify(after)) return { methods: current };
        for (const [sortOrder, m] of next.entries())
          await tx.branchPaymentMethodSetting.upsert({
            where: { locationId_method: { locationId: s.locationId, method: m.method } },
            create: { locationId: s.locationId, method: m.method, enabled: m.enabled, sortOrder },
            update: { enabled: m.enabled, sortOrder },
          });
        await tx.auditLog.create({
          data: {
            organizationId: s.organizationId,
            userId: currentUserId(),
            entityType: 'Location',
            entityId: s.locationId,
            action: 'branch.payment_methods.updated',
            before,
            after,
          },
        });
        return { methods: next };
      },
      BRANCH_CASH_VERTICALS,
    );
  }
}

@Controller('food-service')
@RequiresBusinessCapability('branch.cash')
export class BranchPaymentMethodsController {
  constructor(@Inject(BranchPaymentMethodsService) private readonly service: BranchPaymentMethodsService) {}
  @BeautyAccess('finance', 'view')
  @Get('payment-methods') @Access('desk') get() {
    return this.service.get();
  }
  @BeautyAccess('settings', 'update')
  @Put('payment-methods') @Access('settings') update(@Body() body: unknown) {
    return this.service.update(body);
  }
}
