import {previousOwnerPeriod,compareOwnerMoney} from '../../../../packages/domain/src/owner-summary/previous';
import { projectDailyMoney } from '../../../../packages/domain/src/owner-summary/daily';
import 'reflect-metadata';
import { BadRequestException, Controller, ForbiddenException, Get, Inject, Injectable, Query } from '@nestjs/common';
import { canAt, dayOffsetUtc, localDate, zonedStartOfDay } from '@pms/domain';
import { summarizePaidExpenses, type ExpenseSource } from '../../../../packages/domain/src/owner-summary/expenses';
import { PrismaService } from '../database/prisma.provider';
import { readBeautyWorkload } from '../beauty/workload';
import { readHospitalityWorkload } from '../hospitality/workload';
import { readRestaurantWorkload } from '../food-service/workload';
import { readOwnerMoney } from './owner-money';
import { readOwnerAttention } from './owner-attention';
import { currentAssignments, currentLocationId, currentOrganizationId, currentRole, hasSignedInActor } from '../auth/request-context';
import { Access } from '../auth/access.decorator';
import { ScopeAware } from '../auth/scope-aware.decorator';

/** Read-only foundation. Missing projections are explicit, never synthetic zero metrics. */
@Injectable()
export class OwnerSummaryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async report(period: string = 'today', now = new Date()) {
    if (!['today', 'week', 'month'].includes(period)) throw new BadRequestException('Invalid owner summary period');
    const locationId = currentLocationId(), organizationId = currentOrganizationId();
    if (!hasSignedInActor() || !locationId || !organizationId) throw new ForbiddenException('Select an authorized location');
    const location = await this.prisma.db.location.findFirst({
      where: { id: locationId, business: { organizationId } },
      select: { id: true, timezone: true, business: { select: { id: true, vertical: true } }, property: { select: { id: true } } },
    });
    if (!location || !canAt(currentRole() ?? 'STAFF', currentAssignments(), 'reports', { businessId: location.business.id, locationId }))
      throw new ForbiddenException('Reports are not available in this scope');
    const today = localDate(now, location.timezone);
    const fromDate = period === 'month' ? `${today.slice(0, 7)}-01` : period === 'week' ? dayOffsetUtc(today, -6) : today;
    const from = zonedStartOfDay(fromDate, location.timezone);
    const vertical = location.business.vertical;
    const supported = ['BEAUTY', 'FOOD_SERVICE', 'HOSPITALITY'].includes(vertical);
    const readProjection = async (fromDate:string, today:string, from:Date, now:Date) => {
    const occurredAt = { gte: from, lte: now };
    let sources: (ExpenseSource & { occurredAt: Date })[] = [];
    if (vertical === 'BEAUTY' || vertical === 'FOOD_SERVICE') {
      const rows = await this.prisma.db.restaurantCashOperation.findMany({
        where: { locationId, kind: 'EXPENSE', status: 'COMPLETED', appointmentId: null, orderId: null, occurredAt },
        select: { id: true, amount: true, currency: true, occurredAt: true },
      });
      sources = rows.map(r => ({ sourceType: 'RESTAURANT_CASH', sourceId: r.id, occurredAt: r.occurredAt, locationId, kind: 'EXPENSE', status: 'COMPLETED', amountMinor: r.amount, currency: r.currency, categoryId: null }));
    } else if (vertical === 'HOSPITALITY' && location.property) {
      const rows = await this.prisma.db.$queryRaw<Array<{id:string;amount:bigint;occurredAt:Date;currency:string|null}>>`SELECT c.id,c.amount,c.occurred_at AS "occurredAt", CASE WHEN ${process.env.EXPENSE_LINKS_ENABLED === '1'} THEN to_jsonb(c)->>'currency_snapshot' ELSE NULL END AS currency FROM cash_operations c JOIN properties p ON p.id=c.property_id WHERE c.property_id=${location.property.id}::uuid AND p.location_id=${locationId}::uuid AND p.organization_id=${organizationId}::uuid AND c.status='COMPLETED' AND c.kind='EXPENSE' AND c.occurred_at>=${from} AND c.occurred_at<=${now}`;
      sources = rows.map(r => ({ sourceType: 'HOTEL_CASH', sourceId: r.id, occurredAt: r.occurredAt, locationId, kind: 'EXPENSE', status: 'COMPLETED', amountMinor: r.amount, currency: r.currency, categoryId: null }));
    }
    const classificationEnabled = process.env.EXPENSE_LINKS_ENABLED === '1';
    if (classificationEnabled && sources.length) {
      // Enrichment only; verified completed cash rows remain the sole monetary input.
      const links = await this.prisma.db.$queryRaw<Array<{ sourceType: string; sourceId: string; categoryId: string; categoryName: string }>>`
        SELECT CASE WHEN s.cash_operation_id IS NOT NULL THEN 'HOTEL_CASH' ELSE 'RESTAURANT_CASH' END AS "sourceType",
          coalesce(s.cash_operation_id,s.restaurant_cash_operation_id)::text AS "sourceId",
          c.id::text AS "categoryId", c.name AS "categoryName"
        FROM expense_settlements s
        JOIN expense_documents d ON d.id=s.expense_document_id AND d.location_id=s.location_id
        JOIN expense_categories c ON c.id=d.category_id AND c.location_id=d.location_id
        JOIN locations l ON l.id=s.location_id JOIN businesses b ON b.id=l.business_id
        WHERE s.location_id=${locationId}::uuid AND b.organization_id=${organizationId}::uuid
      `;
      const bySource = new Map(links.map(r => [`${r.sourceType}:${r.sourceId}`,r]));
      sources = sources.map(r => {
        const link = bySource.get(`${r.sourceType}:${r.sourceId}`);
        return link ? {...r,categoryId:link.categoryId,categoryName:link.categoryName} : r;
      });
    }
    const classificationReason = !classificationEnabled ? 'EXPENSE_DOCUMENT_LINKS_NOT_CONNECTED'
      : !supported ? 'UNSUPPORTED_SOURCE' : sources.some(r => r.categoryId === null) ? 'UNCLASSIFIED_EXPENSE_SOURCES' : null;
    return {metrics:{
        paidExpenses: supported && (vertical !== 'HOSPITALITY' || location.property) ? {...summarizePaidExpenses(locationId, sources),daily:projectDailyMoney(sources,{fromDate,toDate:today,timezone:location.timezone,now})} : { state: 'UNAVAILABLE' as const, reason: 'UNSUPPORTED_SOURCE', currencies: null },
        ...await readOwnerMoney(this.prisma.db, { locationId, organizationId, vertical, propertyId: location.property?.id ?? null, from, now, fromDate, toDate: today, timezone: location.timezone }),
},classificationReason,classificationState: !classificationEnabled || !supported ? 'UNAVAILABLE' as const : classificationReason ? 'PARTIAL' as const : 'READY' as const};
    };
    const projection=await readProjection(fromDate,today,from,now);
    const prior=previousOwnerPeriod(period,now,location.timezone);
    const previousProjection=prior.period ? await readProjection(prior.period.fromDate,prior.period.toDate,new Date(prior.period.fromUtc),new Date(prior.period.toUtc)) : null;
    const previous=previousProjection && prior.period ? {period:prior.period,...previousProjection.metrics,classificationState:previousProjection.classificationState,classificationReason:previousProjection.classificationReason} : null;
    return {
      sourceVersion: 'owner-cash-foundation-v1', generatedAt: now.toISOString(), state: 'PARTIAL' as const,
      scope: { locationId, organizationId, vertical },
      period: { key: period, timezone: location.timezone, fromDate, toDate: today, fromUtc: from.toISOString(), toUtc: now.toISOString(), isFinalized: false },
      current: projection.metrics,
      previous, comparisonReason: prior.reason,
      comparisons: {revenue:compareOwnerMoney(projection.metrics.revenue,previous?.revenue??null),receipts:compareOwnerMoney(projection.metrics.receipts,previous?.receipts??null),paidExpenses:compareOwnerMoney(projection.metrics.paidExpenses,previous?.paidExpenses??null)},
      workload: vertical === 'BEAUTY' ? await readBeautyWorkload(this.prisma.db, locationId, from, now, location.timezone) : vertical === 'FOOD_SERVICE' ? await readRestaurantWorkload(this.prisma.db, locationId, from, now) : vertical === 'HOSPITALITY' ? await readHospitalityWorkload(this.prisma.db, { propertyId: location.property?.id ?? null, locationId, organizationId }, fromDate, today, now) : { state: 'UNAVAILABLE' as const, reason: supported ? 'HISTORY_NOT_CAPTURED' : 'UNSUPPORTED_VERTICAL', numerator: null, denominator: null, coverage: [], requestedFromUtc: from.toISOString(), requestedToUtc: now.toISOString() },
      classificationState: projection.classificationState,
      classificationReason: projection.classificationReason,
      // «Требуют решения»: всегда сегодня филиала, не выбранный период (решение 21.10.2026)
      attention: supported ? await readOwnerAttention(this.prisma.db, { locationId, organizationId, businessId: location.business.id, vertical, timezone: location.timezone, propertyId: location.property?.id ?? null, now, unclassifiedExpenses: projection.classificationReason === 'UNCLASSIFIED_EXPENSE_SOURCES' }) : [],
    };
  }
}
@Controller('owner-summary')
@ScopeAware()
export class OwnerSummaryController {
  constructor(@Inject(OwnerSummaryService) private readonly service: OwnerSummaryService) {}
  @Get()
  @Access('reports')
  report(@Query('period') period?: string) { return this.service.report(period); }
}
