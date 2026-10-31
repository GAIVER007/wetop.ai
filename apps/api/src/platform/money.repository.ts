import 'reflect-metadata';
import type { PartnerRow, PartnersSource } from './partners';
import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@pms/database';
import { PrismaService } from '../database/prisma.provider';
import type { ExpenseCategory, MoneySource } from './money';

export const MONEY_REPOSITORY = Symbol('MONEY_REPOSITORY');

export interface PlanRow {
  id: string;
  name: string;
  priceCents: bigint;
  periodMonths: number;
  active: boolean;
  /** Разовая выплата партнёру за первый чек клиента (DATA_MODEL §63.2); не задана: null */
  partnerPayoutCents?: bigint | null;
}
export interface SubscriptionRow {
  organizationId: string;
  planId: string | null;
  monthlyCents: bigint;
  paidUntil: string | null;
  note: string | null;
  /** Миграция 176: промокод, скидка %, автопродление */
  promoCode?: string | null;
  discountPercent?: number | null;
  autoRenew?: boolean;
}
export interface PaymentRow {
  id: string;
  organizationId: string;
  amountCents: bigint;
  paidOn: string;
  note: string | null;
  voided: boolean;
  /** `PLAN` тариф, `ADDON` доп (ИИ-продавец, таргетолог, контент, продвижение) */
  kind?: 'PLAN' | 'ADDON';
}
export interface ExpenseRow {
  id: string;
  category: ExpenseCategory;
  amountCents: bigint;
  spentOn: string;
  note: string | null;
  voided: boolean;
  /** Миграция 176: кому заплатили, проект, повторяется, документ */
  payee?: string | null;
  project?: string | null;
  recurring?: boolean;
  documentRef?: string | null;
}
export interface TeamRow {
  id: string;
  name: string;
  /** Должность; у цифрового сотрудника пусто */
  role: string | null;
  email: string | null;
  phone: string | null;
  /** PERSON человек, DIGITAL цифровой сотрудник (имя и зарплата), миграция 172 */
  kind: 'PERSON' | 'DIGITAL';
  monthlySalaryCents: bigint | null;
  active: boolean;
}

export interface MoneyRepository {
  /** Таблиц денег ещё нет (миграция 166 не применена): кабинет говорит «не подключено» */
  ready(): Promise<boolean>;
  source(): Promise<Omit<MoneySource, 'clientIds'>>;
  plans(): Promise<PlanRow[]>;
  subscriptions(): Promise<SubscriptionRow[]>;
  payments(month: string): Promise<PaymentRow[]>;
  expenses(month: string): Promise<ExpenseRow[]>;
  team(): Promise<TeamRow[]>;
  organizationExists(id: string): Promise<boolean>;
  savePlan(input: { id: string | null; name: string; priceCents: bigint; periodMonths: number; active: boolean; partnerPayoutCents?: bigint | null }): Promise<PlanRow>;
  planExists(id: string): Promise<boolean>;
  saveSubscription(input: SubscriptionRow & { by: string | null }): Promise<SubscriptionRow>;
  addPayment(input: { organizationId: string; amountCents: bigint; paidOn: string; note: string | null; by: string | null; extendMonths: number; kind?: 'PLAN' | 'ADDON' }): Promise<PaymentRow>;
  voidPayment(input: { id: string; by: string | null }): Promise<boolean>;
  addExpense(input: { category: ExpenseCategory; amountCents: bigint; spentOn: string; note: string | null; by: string | null; extras?: { payee: string | null; project: string | null; recurring: boolean; documentRef: string | null } }): Promise<ExpenseRow>;
  voidExpense(input: { id: string; by: string | null }): Promise<boolean>;
  saveTeamMember(input: Omit<TeamRow, 'id'> & { id: string | null }): Promise<TeamRow | null>;
  /** Партнёры (миграция 172): таблицы ещё нет, раздел говорит «не подключено» */
  partnersReady(): Promise<boolean>;
  partnersSource(): Promise<PartnersSource>;
  savePartner(input: Omit<PartnerRow, 'id'> & { id: string | null }): Promise<PartnerRow | null>;
  partnerExists(id: string): Promise<boolean>;
  /** Чей клиент: `partnerId` null снимает отметку */
  setClientPartner(input: { organizationId: string; partnerId: string | null; by: string | null }): Promise<void>;
  payPartner(input: { partnerId: string; amountCents: bigint; spentOn: string; note: string | null; by: string | null }): Promise<ExpenseRow>;
}

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const dateOf = (s: string) => new Date(`${s}T00:00:00Z`);
const monthRange = (month: string) => {
  const from = dateOf(`${month}-01`);
  const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
  return { gte: from, lt: to };
};

/** «Оплачено до» после оплаты: от большего из прежнего срока и дня оплаты, плюс месяцы тарифа */
export function extendPaidUntil(before: string | null, paidOn: string, months: number): string {
  const base = before && before > paidOn ? before : paidOn;
  const d = dateOf(base);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last))).toISOString().slice(0, 10);
}

@Injectable()
export class PrismaMoneyRepository implements MoneyRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async ready(): Promise<boolean> {
    const rows = await this.prisma.db.$queryRaw<Array<{ ok: boolean }>>(
      Prisma.sql`SELECT to_regclass('platform_payments') IS NOT NULL AS ok`,
    );
    return rows[0]?.ok === true;
  }

  async source() {
    const since = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 6, 1));
    const [payments, expenses, subscriptions] = await Promise.all([
      this.prisma.db.platformPayment.findMany({ where: { paidOn: { gte: since } } }),
      this.prisma.db.platformExpense.findMany({ where: { spentOn: { gte: since } } }),
      this.prisma.db.platformSubscription.findMany(),
    ]);
    return {
      payments: payments.map((p) => ({
        organizationId: p.organizationId,
        amountCents: p.amountCents,
        paidOn: day(p.paidOn)!,
        voided: p.voidedAt !== null,
      })),
      expenses: expenses.map((e) => ({
        category: e.category as ExpenseCategory,
        amountCents: e.amountCents,
        spentOn: day(e.spentOn)!,
        voided: e.voidedAt !== null,
      })),
      subscriptions: subscriptions.map((s) => ({
        organizationId: s.organizationId,
        monthlyCents: s.monthlyCents,
        paidUntil: day(s.paidUntil),
      })),
    };
  }

  async plans(): Promise<PlanRow[]> {
    const rows = await this.prisma.db.platformPlan.findMany({ orderBy: [{ active: 'desc' }, { priceCents: 'asc' }] });
    return rows.map((p) => ({ id: p.id, name: p.name, priceCents: p.priceCents, periodMonths: p.periodMonths, active: p.active, partnerPayoutCents: p.partnerPayoutCents }));
  }

  async subscriptions(): Promise<SubscriptionRow[]> {
    const rows = await this.prisma.db.platformSubscription.findMany();
    return rows.map((s) => ({
      organizationId: s.organizationId,
      planId: s.planId,
      monthlyCents: s.monthlyCents,
      paidUntil: day(s.paidUntil),
      note: s.note,
      promoCode: s.promoCode,
      discountPercent: s.discountPercent,
      autoRenew: s.autoRenew,
    }));
  }

  async payments(month: string): Promise<PaymentRow[]> {
    const rows = await this.prisma.db.platformPayment.findMany({
      where: { paidOn: monthRange(month) },
      orderBy: [{ paidOn: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((p) => ({
      id: p.id,
      organizationId: p.organizationId,
      amountCents: p.amountCents,
      paidOn: day(p.paidOn)!,
      note: p.note,
      voided: p.voidedAt !== null,
      kind: p.kind === 'ADDON' ? ('ADDON' as const) : ('PLAN' as const),
    }));
  }

  async expenses(month: string): Promise<ExpenseRow[]> {
    const rows = await this.prisma.db.platformExpense.findMany({
      where: { spentOn: monthRange(month) },
      orderBy: [{ spentOn: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((e) => ({
      id: e.id,
      category: e.category as ExpenseCategory,
      amountCents: e.amountCents,
      spentOn: day(e.spentOn)!,
      note: e.note,
      voided: e.voidedAt !== null,
      payee: e.payee,
      project: e.project,
      recurring: e.recurring,
      documentRef: e.documentRef,
    }));
  }

  async team(): Promise<TeamRow[]> {
    const rows = await this.prisma.db.platformTeamMember.findMany({ orderBy: [{ active: 'desc' }, { createdAt: 'asc' }] });
    return rows.map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role,
      email: m.email,
      phone: m.phone,
      kind: m.kind === 'DIGITAL' ? ('DIGITAL' as const) : ('PERSON' as const),
      monthlySalaryCents: m.monthlySalaryCents,
      active: m.active,
    }));
  }

  async organizationExists(id: string): Promise<boolean> {
    return (await this.prisma.db.organization.count({ where: { id } })) === 1;
  }

  async planExists(id: string): Promise<boolean> {
    return (await this.prisma.db.platformPlan.count({ where: { id } })) === 1;
  }

  async savePlan(input: { id: string | null; name: string; priceCents: bigint; periodMonths: number; active: boolean; partnerPayoutCents?: bigint | null }) {
    const data = {
      name: input.name,
      priceCents: input.priceCents,
      periodMonths: input.periodMonths,
      active: input.active,
      ...(input.partnerPayoutCents !== undefined ? { partnerPayoutCents: input.partnerPayoutCents } : {}),
      updatedAt: new Date(),
    };
    const row = input.id
      ? await this.prisma.db.platformPlan.update({ where: { id: input.id }, data })
      : await this.prisma.db.platformPlan.create({ data: { id: randomUUID(), ...data } });
    return { id: row.id, name: row.name, priceCents: row.priceCents, periodMonths: row.periodMonths, active: row.active, partnerPayoutCents: row.partnerPayoutCents };
  }

  async saveSubscription(input: SubscriptionRow & { by: string | null }): Promise<SubscriptionRow> {
    const data = {
      planId: input.planId,
      monthlyCents: input.monthlyCents,
      paidUntil: input.paidUntil ? dateOf(input.paidUntil) : null,
      note: input.note,
      ...(input.autoRenew !== undefined ? { promoCode: input.promoCode ?? null, discountPercent: input.discountPercent ?? null, autoRenew: input.autoRenew } : {}),
      updatedAt: new Date(),
      updatedBy: input.by,
    };
    const row = await this.prisma.db.$transaction(async (tx) => {
      const saved = await tx.platformSubscription.upsert({
        where: { organizationId: input.organizationId },
        create: { organizationId: input.organizationId, ...data },
        update: data,
      });
      await tx.auditLog.create({
        data: {
          userId: input.by,
          entityType: 'organization',
          entityId: input.organizationId,
          action: 'platform.subscription.saved',
          after: { planId: input.planId, monthlyCents: String(input.monthlyCents), paidUntil: input.paidUntil },
        },
      });
      return saved;
    });
    return { organizationId: row.organizationId, planId: row.planId, monthlyCents: row.monthlyCents, paidUntil: day(row.paidUntil), note: row.note };
  }

  async addPayment(input: { organizationId: string; amountCents: bigint; paidOn: string; note: string | null; by: string | null; extendMonths: number; kind?: 'PLAN' | 'ADDON' }) {
    return this.prisma.db.$transaction(async (tx) => {
      const row = await tx.platformPayment.create({
        data: {
          id: randomUUID(),
          organizationId: input.organizationId,
          amountCents: input.amountCents,
          kind: input.kind ?? 'PLAN',
          paidOn: dateOf(input.paidOn),
          note: input.note,
          createdBy: input.by,
        },
      });
      // оплата продлевает «оплачено до» подписки, если подписка есть
      if (input.extendMonths > 0) {
        const sub = await tx.platformSubscription.findUnique({ where: { organizationId: input.organizationId } });
        if (sub)
          await tx.platformSubscription.update({
            where: { organizationId: input.organizationId },
            data: {
              paidUntil: dateOf(extendPaidUntil(day(sub.paidUntil), input.paidOn, input.extendMonths)),
              updatedAt: new Date(),
              updatedBy: input.by,
            },
          });
      }
      await tx.auditLog.create({
        data: {
          userId: input.by,
          entityType: 'organization',
          entityId: input.organizationId,
          action: 'platform.payment.added',
          after: { paymentId: row.id, amountCents: String(input.amountCents), paidOn: input.paidOn, kind: input.kind ?? 'PLAN' },
        },
      });
      return {
        id: row.id,
        organizationId: row.organizationId,
        amountCents: row.amountCents,
        paidOn: input.paidOn,
        note: row.note,
        voided: false,
      };
    });
  }

  async voidPayment(input: { id: string; by: string | null }): Promise<boolean> {
    const { count } = await this.prisma.db.platformPayment.updateMany({
      where: { id: input.id, voidedAt: null },
      data: { voidedAt: new Date(), voidedBy: input.by },
    });
    return count === 1;
  }

  async addExpense(input: {
    category: ExpenseCategory;
    amountCents: bigint;
    spentOn: string;
    note: string | null;
    by: string | null;
    extras?: { payee: string | null; project: string | null; recurring: boolean; documentRef: string | null };
  }) {
    const row = await this.prisma.db.platformExpense.create({
      data: {
        id: randomUUID(),
        category: input.category,
        amountCents: input.amountCents,
        spentOn: dateOf(input.spentOn),
        note: input.note,
        createdBy: input.by,
        ...(input.extras ?? {}),
      },
    });
    return {
      id: row.id,
      category: input.category,
      amountCents: row.amountCents,
      spentOn: input.spentOn,
      note: row.note,
      voided: false,
      payee: row.payee,
      project: row.project,
      recurring: row.recurring,
      documentRef: row.documentRef,
    };
  }

  async voidExpense(input: { id: string; by: string | null }): Promise<boolean> {
    const { count } = await this.prisma.db.platformExpense.updateMany({
      where: { id: input.id, voidedAt: null },
      data: { voidedAt: new Date(), voidedBy: input.by },
    });
    return count === 1;
  }

  async saveTeamMember(input: Omit<TeamRow, 'id'> & { id: string | null }): Promise<TeamRow | null> {
    const data = {
      name: input.name,
      role: input.role,
      email: input.email,
      phone: input.phone,
      kind: input.kind,
      monthlySalaryCents: input.monthlySalaryCents,
      active: input.active,
      updatedAt: new Date(),
    };
    if (input.id) {
      const { count } = await this.prisma.db.platformTeamMember.updateMany({ where: { id: input.id }, data });
      if (count !== 1) return null;
      return { ...input, id: input.id };
    }
    const row = await this.prisma.db.platformTeamMember.create({ data: { id: randomUUID(), ...data } });
    return { ...input, id: row.id };
  }

  async partnersReady(): Promise<boolean> {
    const rows = await this.prisma.db.$queryRaw<Array<{ ok: boolean }>>(
      Prisma.sql`SELECT to_regclass('platform_partners') IS NOT NULL AS ok`,
    );
    return rows[0]?.ok === true;
  }

  async partnersSource(): Promise<PartnersSource> {
    const db = this.prisma.db;
    const [partners, links, payments, payouts, subs] = await Promise.all([
      db.platformPartner.findMany({ orderBy: { createdAt: 'asc' } }),
      db.platformClientPartner.findMany({ select: { organizationId: true, partnerId: true } }),
      db.platformPayment.findMany({ select: { organizationId: true, amountCents: true, voidedAt: true, kind: true, paidOn: true } }),
      db.platformExpense.findMany({ where: { category: 'PARTNERS' }, select: { partnerId: true, amountCents: true, voidedAt: true } }),
      // разовая выплата партнёру за тариф подписки клиента (DATA_MODEL §63.2)
      db.platformSubscription.findMany({ select: { organizationId: true, plan: { select: { partnerPayoutCents: true } } } }),
    ]);
    return {
      partners: partners.map((p) => ({ id: p.id, name: p.name, phone: p.phone, email: p.email, percentBp: p.percentBp, active: p.active })),
      links: links.flatMap((l) => (l.partnerId ? [{ organizationId: l.organizationId, partnerId: l.partnerId }] : [])),
      payments: payments.map((p) => ({
        organizationId: p.organizationId,
        amountCents: p.amountCents,
        voided: p.voidedAt !== null,
        kind: p.kind === 'ADDON' ? ('ADDON' as const) : ('PLAN' as const),
        paidOn: day(p.paidOn)!,
      })),
      planPayouts: subs.flatMap((x) => (x.plan?.partnerPayoutCents != null ? [{ organizationId: x.organizationId, payoutCents: x.plan.partnerPayoutCents }] : [])),
      payouts: payouts.flatMap((p) => (p.partnerId ? [{ partnerId: p.partnerId, amountCents: p.amountCents, voided: p.voidedAt !== null }] : [])),
    };
  }

  async savePartner(input: Omit<PartnerRow, 'id'> & { id: string | null }): Promise<PartnerRow | null> {
    const data = { name: input.name, phone: input.phone, email: input.email, percentBp: input.percentBp, active: input.active, updatedAt: new Date() };
    if (input.id) {
      const { count } = await this.prisma.db.platformPartner.updateMany({ where: { id: input.id }, data });
      return count === 1 ? { ...input, id: input.id } : null;
    }
    const row = await this.prisma.db.platformPartner.create({ data: { id: randomUUID(), ...data } });
    return { ...input, id: row.id };
  }

  async partnerExists(id: string): Promise<boolean> {
    return (await this.prisma.db.platformPartner.count({ where: { id } })) === 1;
  }

  async setClientPartner(input: { organizationId: string; partnerId: string | null; by: string | null }): Promise<void> {
    const db = this.prisma.db;
    await db.$transaction(async (tx) => {
      // снятая отметка: partner_id NULL, строки не удаляются (DELETE нет ни у одной роли)
      await tx.platformClientPartner.upsert({
        where: { organizationId: input.organizationId },
        create: { organizationId: input.organizationId, partnerId: input.partnerId, updatedBy: input.by },
        update: { partnerId: input.partnerId, updatedBy: input.by, updatedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          userId: input.by,
          entityType: 'organization',
          entityId: input.organizationId,
          action: 'platform.client.partner_set',
          after: { partnerId: input.partnerId },
        },
      });
    });
  }

  async payPartner(input: { partnerId: string; amountCents: bigint; spentOn: string; note: string | null; by: string | null }) {
    const row = await this.prisma.db.platformExpense.create({
      data: {
        id: randomUUID(),
        category: 'PARTNERS',
        partnerId: input.partnerId,
        amountCents: input.amountCents,
        spentOn: dateOf(input.spentOn),
        note: input.note,
        createdBy: input.by,
      },
    });
    return { id: row.id, category: 'PARTNERS' as const, amountCents: row.amountCents, spentOn: input.spentOn, note: row.note, voided: false };
  }
}
