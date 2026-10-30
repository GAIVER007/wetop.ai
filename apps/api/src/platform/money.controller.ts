import 'reflect-metadata';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  ServiceUnavailableException,
  UseInterceptors,
} from '@nestjs/common';
import { ServiceDatabaseInterceptor } from '../database/service-database.interceptor';
import { currentOrganizationId, currentUserId } from '../auth/request-context';
import { Access } from '../auth/access.decorator';
import { requirePlatformAdmin } from './admin';
import { CABINET_REPOSITORY, type CabinetRepository } from './cabinet.repository';
import { EXPENSE_CATEGORIES, buildMoney, parseIsoDate, parseUsdCents, type ExpenseCategory } from './money';
import { MONEY_REPOSITORY, type MoneyRepository } from './money.repository';

export const MONEY_NOT_READY = 'Деньги компании ещё не подключены: нужна миграция 166';
export const MONEY_AMOUNT = 'Сумма в долларах: например 49 или 49.50';
export const MONEY_DATE = 'Дата: выберите день';
export const MONEY_NO_CLIENT = 'Такого клиента нет';
export const MONEY_NO_PLAN = 'Такого тарифа нет';
export const MONEY_PLAN_NAME = 'Название тарифа: от 1 до 100 знаков';
export const MONEY_CATEGORY = 'Выберите статью расхода';
export const MONEY_TEAM_NAME = 'Имя: от 1 до 200 знаков';
export const MONEY_TEAM_ROLE = 'Должность: от 1 до 100 знаков';
export const MONEY_NOT_FOUND = 'Запись не найдена или уже отменена';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cents = (v: bigint | null) => (v === null ? null : String(v));
const text = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t.slice(0, max);
};
const thisMonth = () => new Date().toISOString().slice(0, 7);

/**
 * Деньги компании WETOP (DATA_MODEL §63, владелец 28.10.2026): тарифы, подписки клиентов, оплаты, расходы и команда.
 * Суммы целыми центами USD строкой. Только главному администратору; таблицы без RLS читает служебная роль.
 */
@Access('platform')
@UseInterceptors(ServiceDatabaseInterceptor)
@Controller('platform')
export class MoneyController {
  constructor(
    @Inject(MONEY_REPOSITORY) private readonly money: MoneyRepository,
    @Inject(CABINET_REPOSITORY) private readonly cabinet: CabinetRepository,
  ) {}

  private async ready() {
    requirePlatformAdmin();
    if (!(await this.money.ready())) throw new ServiceUnavailableException(MONEY_NOT_READY);
  }

  @Get('money')
  @Header('Cache-Control', 'no-store')
  async overview(@Query('month') rawMonth?: string) {
    requirePlatformAdmin();
    const month = typeof rawMonth === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : thisMonth();
    if (!(await this.money.ready())) return { ready: false, month };
    const own = currentOrganizationId();
    const now = new Date();
    const [src, orgs, plans, subscriptions, payments, expenses, team] = await Promise.all([
      this.money.source(),
      this.cabinet.source({ since30d: now, ownOrganizationId: own }),
      this.money.plans(),
      this.money.subscriptions(),
      this.money.payments(month),
      this.money.expenses(month),
      this.money.team(),
    ]);
    // кого не считать клиентом решил репозиторий кабинета (запись компании WETOP или, без неё, своя организация)
    const clients = orgs.organizations.filter((o) => o.id !== orgs.ownOrganizationId && o.status !== 'SUSPENDED');
    const names = new Map(orgs.organizations.map((o) => [o.id, o.name]));
    const summary = buildMoney({ ...src, clientIds: clients.map((c) => c.id) }, month, now.toISOString().slice(0, 10));
    const subs = new Map(subscriptions.map((s) => [s.organizationId, s]));
    return {
      ready: true,
      month,
      summary: { ...summary, overdue: summary.overdue.map((o) => ({ ...o, name: names.get(o.organizationId) ?? '' })) },
      plans: plans.map((p) => ({ ...p, priceCents: cents(p.priceCents) })),
      clients: clients.map((c) => {
        const s = subs.get(c.id);
        return {
          id: c.id,
          name: c.name,
          planId: s?.planId ?? null,
          monthlyCents: s ? cents(s.monthlyCents) : null,
          paidUntil: s?.paidUntil ?? null,
          note: s?.note ?? null,
        };
      }),
      payments: payments.map((p) => ({ ...p, amountCents: cents(p.amountCents), name: names.get(p.organizationId) ?? '' })),
      expenses: expenses.map((e) => ({ ...e, amountCents: cents(e.amountCents) })),
      team: team.map((m) => ({ ...m, monthlySalaryCents: cents(m.monthlySalaryCents) })),
      categories: EXPENSE_CATEGORIES,
    };
  }

  @Post('plans')
  async createPlan(@Body() body: unknown) {
    await this.ready();
    return this.savePlan(null, body);
  }

  @Put('plans/:id')
  async updatePlan(@Param('id') id: string, @Body() body: unknown) {
    await this.ready();
    if (!UUID.test(id) || !(await this.money.planExists(id))) throw new NotFoundException(MONEY_NO_PLAN);
    return this.savePlan(id, body);
  }

  private async savePlan(id: string | null, body: unknown) {
    const b = (body ?? {}) as Record<string, unknown>;
    const name = text(b['name'], 101);
    if (!name || name.length > 100) throw new BadRequestException(MONEY_PLAN_NAME);
    const price = parseUsdCents(b['price']);
    if (price === null) throw new BadRequestException(MONEY_AMOUNT);
    const periodMonths = b['periodMonths'] === 12 || b['periodMonths'] === '12' ? 12 : 1;
    const saved = await this.money.savePlan({ id, name, priceCents: price, periodMonths, active: b['active'] !== false && b['active'] !== 'false' });
    return { ...saved, priceCents: cents(saved.priceCents) };
  }

  @Put('subscriptions/:organizationId')
  async saveSubscription(@Param('organizationId') organizationId: string, @Body() body: unknown) {
    await this.ready();
    if (!UUID.test(organizationId) || !(await this.money.organizationExists(organizationId)))
      throw new NotFoundException(MONEY_NO_CLIENT);
    const b = (body ?? {}) as Record<string, unknown>;
    const planId = typeof b['planId'] === 'string' && b['planId'] ? b['planId'] : null;
    if (planId && (!UUID.test(planId) || !(await this.money.planExists(planId)))) throw new BadRequestException(MONEY_NO_PLAN);
    const monthly = parseUsdCents(b['monthly']);
    if (monthly === null) throw new BadRequestException(MONEY_AMOUNT);
    const rawUntil = b['paidUntil'];
    const paidUntil = rawUntil === null || rawUntil === '' || rawUntil === undefined ? null : parseIsoDate(rawUntil);
    if (rawUntil && !paidUntil) throw new BadRequestException(MONEY_DATE);
    const saved = await this.money.saveSubscription({
      organizationId,
      planId,
      monthlyCents: monthly,
      paidUntil,
      note: text(b['note'], 300),
      by: currentUserId(),
    });
    return { ...saved, monthlyCents: cents(saved.monthlyCents) };
  }

  @Post('payments')
  async addPayment(@Body() body: unknown) {
    await this.ready();
    const b = (body ?? {}) as Record<string, unknown>;
    const organizationId = typeof b['organizationId'] === 'string' ? b['organizationId'] : '';
    if (!UUID.test(organizationId) || !(await this.money.organizationExists(organizationId)))
      throw new BadRequestException(MONEY_NO_CLIENT);
    const amount = parseUsdCents(b['amount']);
    if (amount === null || amount === 0n) throw new BadRequestException(MONEY_AMOUNT);
    const paidOn = parseIsoDate(b['paidOn']);
    if (!paidOn) throw new BadRequestException(MONEY_DATE);
    const extendMonths = b['extendMonths'] === 12 || b['extendMonths'] === '12' ? 12 : b['extendMonths'] === 0 || b['extendMonths'] === '0' ? 0 : 1;
    const saved = await this.money.addPayment({
      organizationId,
      amountCents: amount,
      paidOn,
      note: text(b['note'], 300),
      by: currentUserId(),
      extendMonths,
    });
    return { ...saved, amountCents: cents(saved.amountCents) };
  }

  @Post('payments/:id/void')
  async voidPayment(@Param('id') id: string) {
    await this.ready();
    if (!UUID.test(id) || !(await this.money.voidPayment({ id, by: currentUserId() }))) throw new NotFoundException(MONEY_NOT_FOUND);
    return { ok: true };
  }

  @Post('expenses')
  async addExpense(@Body() body: unknown) {
    await this.ready();
    const b = (body ?? {}) as Record<string, unknown>;
    const category = b['category'];
    if (typeof category !== 'string' || !(EXPENSE_CATEGORIES as readonly string[]).includes(category))
      throw new BadRequestException(MONEY_CATEGORY);
    const amount = parseUsdCents(b['amount']);
    if (amount === null || amount === 0n) throw new BadRequestException(MONEY_AMOUNT);
    const spentOn = parseIsoDate(b['spentOn']);
    if (!spentOn) throw new BadRequestException(MONEY_DATE);
    const saved = await this.money.addExpense({
      category: category as ExpenseCategory,
      amountCents: amount,
      spentOn,
      note: text(b['note'], 300),
      by: currentUserId(),
    });
    return { ...saved, amountCents: cents(saved.amountCents) };
  }

  @Post('expenses/:id/void')
  async voidExpense(@Param('id') id: string) {
    await this.ready();
    if (!UUID.test(id) || !(await this.money.voidExpense({ id, by: currentUserId() }))) throw new NotFoundException(MONEY_NOT_FOUND);
    return { ok: true };
  }

  @Post('team')
  async addTeam(@Body() body: unknown) {
    await this.ready();
    return this.saveTeam(null, body);
  }

  @Put('team/:id')
  async updateTeam(@Param('id') id: string, @Body() body: unknown) {
    await this.ready();
    if (!UUID.test(id)) throw new NotFoundException(MONEY_NOT_FOUND);
    return this.saveTeam(id, body);
  }

  private async saveTeam(id: string | null, body: unknown) {
    const b = (body ?? {}) as Record<string, unknown>;
    const name = text(b['name'], 201);
    if (!name || name.length > 200) throw new BadRequestException(MONEY_TEAM_NAME);
    const role = text(b['role'], 101);
    if (!role || role.length > 100) throw new BadRequestException(MONEY_TEAM_ROLE);
    const rawSalary = b['salary'];
    const salary = rawSalary === null || rawSalary === undefined || rawSalary === '' ? null : parseUsdCents(rawSalary);
    if (rawSalary && salary === null) throw new BadRequestException(MONEY_AMOUNT);
    const saved = await this.money.saveTeamMember({
      id,
      name,
      role,
      email: text(b['email'], 320),
      monthlySalaryCents: salary,
      active: b['active'] !== false && b['active'] !== 'false',
    });
    if (!saved) throw new NotFoundException(MONEY_NOT_FOUND);
    return { ...saved, monthlySalaryCents: cents(saved.monthlySalaryCents) };
  }
}
