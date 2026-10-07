import 'reflect-metadata';
import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { effectiveService } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { ExtensionsService } from '../platform/extensions.service';
import { withOrganizationScope } from '../auth/request-context';
export type ToolVertical = 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE';
export const VERTICAL_TOOL_CAPABILITIES: Record<ToolVertical, readonly string[]> = {
  HOSPITALITY: ['hotel.availability', 'hotel.price', 'hotel.booking'],
  BEAUTY: ['beauty.services'],
  FOOD_SERVICE: ['food.servicePeriods'],
};
export interface AgentToolContext {
  agentId: string; organizationId: string; businessId: string; locationId: string;
  vertical: ToolVertical; timezone: string; currency: string; capabilities: string[];
}
@Injectable()
export class VerticalToolsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ExtensionsService) private readonly extensions: ExtensionsService) {}
  async context(agentId: string): Promise<AgentToolContext> {
    const a = await this.prisma.db.sellerAgent.findFirst({
      where: { id: agentId, scenario: 'sales', lifecycle: 'active' },
      select: { id: true, organizationId: true, scenario: true, lifecycle: true,
        organization: { select: { status: true } },
        location: { select: { id: true, businessId: true, status: true, timezone: true, currency: true,
          business: { select: { id: true, organizationId: true, vertical: true, status: true } } } } },
    });
    const l = a?.location, b = l?.business;
    if (!a || a.lifecycle !== 'active' || a.scenario !== 'sales' || !l || !b ||
        a.organization.status === 'SUSPENDED' || l.status !== 'ACTIVE' || b.status !== 'ACTIVE' ||
        b.organizationId !== a.organizationId || l.businessId !== b.id ||
        !Object.hasOwn(VERTICAL_TOOL_CAPABILITIES, b.vertical)) throw new NotFoundException('Агент недоступен');
    const access = await withOrganizationScope(a.organizationId, () => this.extensions.aiSeller(a.organizationId));
    if (access.access !== 'active') throw new NotFoundException('Агент недоступен');
    return { agentId: a.id, organizationId: a.organizationId, businessId: b.id, locationId: l.id,
      vertical: b.vertical, timezone: l.timezone, currency: l.currency,
      capabilities: [...VERTICAL_TOOL_CAPABILITIES[b.vertical]] };
  }
  private async selected(id: string, vertical: ToolVertical) {
    const context = await this.context(id);
    if (context.vertical !== vertical) throw new ForbiddenException('Инструмент недоступен для этого бизнеса');
    return context;
  }
  async beauty(id: string) {
    const context = await this.selected(id, 'BEAUTY');
    const rows = await withOrganizationScope(context.organizationId, () => this.prisma.db.beautyService.findMany({
      where: { businessId: context.businessId, active: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: { name: true, category: true, durationMinutes: true, price: true, currency: true, active: true,
        locations: { where: { locationId: context.locationId },
          select: { enabled: true, priceOverride: true, durationOverride: true } } },
    }));
    const items = rows.flatMap(row => {
      const location = row.locations[0];
      const value = effectiveService({
        service: { active: row.active, priceMinor: row.price, currency: row.currency, durationMinutes: row.durationMinutes },
        locationCurrency: context.currency,
        locationService: location ? { enabled: location.enabled, priceOverrideMinor: location.priceOverride,
          durationOverrideMinutes: location.durationOverride } : null,
      });
      return value.sellable ? [{ name: row.name, category: row.category, durationMinutes: value.durationMinutes,
        priceMinor: value.priceMinor.toString(), currency: value.currency }] : [];
    });
    return { context, items };
  }
  async food(id: string) {
    const context = await this.selected(id, 'FOOD_SERVICE');
    const rows = await withOrganizationScope(context.organizationId, () => this.prisma.db.servicePeriod.findMany({
      where: { locationId: context.locationId, active: true }, orderBy: [{ weekday: 'asc' }, { timeFrom: 'asc' }, { id: 'asc' }],
      select: { name: true, weekday: true, timeFrom: true, timeTo: true, endsNextDay: true, defaultDurationMinutes: true },
    }));
    return { context, items: rows.map(row => ({ ...row, timeFrom: row.timeFrom.toISOString().slice(11, 16),
      timeTo: row.timeTo.toISOString().slice(11, 16) })) };
  }
}
