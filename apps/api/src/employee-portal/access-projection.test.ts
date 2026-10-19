import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { withSignedInUser, withVerifiedBeautyOperation } from '../auth/request-context';
import { EmployeePortalService } from './employee-portal.service';
import type { PrismaService } from '../database/prisma.provider';

const organizationId = '10000000-0000-4000-8000-000000000001';
const businessId = '10000000-0000-4000-8000-000000000002';
const locationId = '10000000-0000-4000-8000-000000000003';
const otherLocationId = '10000000-0000-4000-8000-000000000007';
const userId = '10000000-0000-4000-8000-000000000004';
const employeeId = '10000000-0000-4000-8000-000000000005';
const otherEmployeeId = '10000000-0000-4000-8000-000000000006';

type Permission = { section: string; action: string; scope: string };
type AppointmentReadArgs={where?:{endsAt?:unknown;appointment?:{locationId?:string|{in?:string[]}}}};
type ConflictAppointmentRow={id:string;startsAt:Date;endsAt:Date;service:{name:string};appointment:{locationId:string}};
type BeautyServiceRow={
  id:string;name:string;durationMinutes:number;price:bigint;currency:string;active:boolean;
  locations:Array<{enabled:boolean;priceOverride:bigint|null;durationOverride:number|null}>;
  employeePrices:Array<{price:bigint}>;
};
type EmployeeServiceRow={serviceId:string};

function fixture(permissions: Permission[], assignmentLocationId:string|null=null) {
  let resolvedEmployeeId = employeeId;
  const privateReads = {
    appointments: vi.fn<(args?:AppointmentReadArgs)=>Promise<ConflictAppointmentRow[]>>(async () => []),
    reviewSummary: vi.fn(async (args?: {where?: {appointment?: {locationId?: string}}}) => args?.where?.appointment?.locationId===locationId
      ?({ _avg: { stars: 5 }, _count: { _all: 1 } })
      :({ _avg: { stars: 4 }, _count: { _all: 2 } })),
    reviewItems: vi.fn(async (args?: {where?: {appointment?: {locationId?: string}}}) => args?.where?.appointment?.locationId===locationId
      ?[{ appointmentId: 'visit-a', stars: 5, comment: 'Branch A', submittedAt: new Date() }]
      :[
        { appointmentId: 'visit-a', stars: 5, comment: 'Branch A', submittedAt: new Date() },
        { appointmentId: 'visit-b', stars: 3, comment: 'Branch B private', submittedAt: new Date() },
      ]),
    paySetting: vi.fn(async () => ({ model: 'FIXED', fixedMinor: 1000n, percent: 0, currency: 'KZT' })),
    payPolicy: vi.fn(async () => ({ percentBasis: 'COMPLETED_SERVICES', revision: 1 })),
    payAdjustments: vi.fn(async () => [{ id: 'adjustment-private', amountMinor: 500n, reason: 'Private bonus' }]),
    payouts: vi.fn(async () => ({ _sum: { amount: 750n } })),
  };
  const location = {
    id: locationId,
    businessId,
    name: 'Synthetic salon',
    timezone: 'Asia/Almaty',
    currency: 'KZT',
    status: 'ACTIVE',
  };
  const employee = {
    id: employeeId,
    businessId,
    userId,
    status: 'ACTIVE',
    locations: [{ location },{location:{...location,id:otherLocationId,name:'Other salon'}}],
  };
  const db = {
    business: { findFirst: vi.fn(async () => ({ id: businessId, name: 'Synthetic Beauty', organizationId, vertical: 'BEAUTY', status: 'ACTIVE' })) },
    membership: { findFirst: vi.fn(async () => ({ userId, organizationId, role: 'MANAGER', status: 'ACTIVE' })) },
    employee: { findMany: vi.fn(async ({ where }: { where: { id?: string } }) => {
      resolvedEmployeeId = where.id === otherEmployeeId ? otherEmployeeId : employeeId;
      return resolvedEmployeeId === otherEmployeeId ? [{ ...employee, id: otherEmployeeId, userId: null }] : [employee];
    }) },
    employeePublicProfile: { findUnique: vi.fn(async () => ({ employeeId, headline: '', biography: '', practiceSinceYear: null, slug: 'synthetic-master', published: false, publicationConsent: false, revision: 1 })) },
    employeeMedia: { findMany: vi.fn(async () => []) },
    employeePortfolioItem: { findMany: vi.fn(async () => []) },
    beautyService: { findMany: vi.fn<() => Promise<BeautyServiceRow[]>>(async () => []) },
    employeeService: { findMany: vi.fn<() => Promise<EmployeeServiceRow[]>>(async () => []) },
    workingHours: { findMany: vi.fn(async () => []) },
    timeOff: { findMany: vi.fn(async () => []) },
    beautyAppointmentReview: { aggregate: privateReads.reviewSummary, findMany: privateReads.reviewItems },
    appointmentLine: { findMany: privateReads.appointments },
    restaurantOrder: { findMany: vi.fn(async () => []), aggregate: vi.fn(async () => ({ _sum: { total: 0n } })) },
    employeePaySetting: { findUnique: privateReads.paySetting },
    beautyPayrollPolicy: { findUnique: privateReads.payPolicy },
    employeePayAdjustment: { findMany: privateReads.payAdjustments },
    restaurantCashOperation: { aggregate: privateReads.payouts },
    beautyPositionAssignment: {
      findMany: vi.fn(async () => [{
        id: 'assignment', userId, organizationId, businessId, locationId:assignmentLocationId, revokedAt: null,
        position: { archivedAt: null, permissions },
      }]),
    },
    $queryRaw: vi.fn(async (sql: TemplateStringsArray) => {
      if (sql.join(' ').includes('LEFT JOIN working_hours')) return [{ sourceRevision: '2026-10-18T00:00:00.000000Z', id: null, weekday: null, timeFrom: null, timeTo: null }];
      return [{ id: resolvedEmployeeId, name: 'Synthetic master', phone: null, email: null, status: 'ACTIVE', profileRevision: '2026-10-18T00:00:00.000000Z' }];
    }),
  };
  return { db, privateReads, service: new EmployeePortalService({ db } as unknown as PrismaService, null) };
}

const actor = (role: 'STAFF' | 'MANAGER' = 'STAFF') => ({
  userId,
  organizationId,
  role,
  scope: 'LOCATION' as const,
  businessId,
  locationId,
  vertical: 'BEAUTY' as const,
});

const selfGet = <T>(fn: () => Promise<T>) => withSignedInUser(actor(), () =>
  withVerifiedBeautyOperation({ section: 'journal', action: 'view', own: true, legacy: 'self' }, fn));
const managerGet = <T>(fn: () => Promise<T>) => withSignedInUser(actor('MANAGER'), () =>
  withVerifiedBeautyOperation({ section: 'employees', action: 'view', legacy: 'staff' }, fn));

describe('Beauty employee portal section projection', () => {
  it('journal.view OWN does not read or return appointments, reviews or payroll without their individual grants', async () => {
    const f = fixture([{ section: 'journal', action: 'view', scope: 'OWN' }]);
    const dto = await selfGet(() => f.service.get(null, { date: '2026-10-18', month: '2026-10' })) as unknown as {
      sectionAccess?: Record<string, boolean>;
      appointments?: unknown[];
      reviews?: { items: unknown[] };
    };

    expect(f.privateReads.appointments).not.toHaveBeenCalled();
    expect(f.privateReads.reviewSummary).not.toHaveBeenCalled();
    expect(f.privateReads.reviewItems).not.toHaveBeenCalled();
    expect(f.privateReads.paySetting).not.toHaveBeenCalled();
    expect(f.privateReads.payPolicy).not.toHaveBeenCalled();
    expect(f.privateReads.payAdjustments).not.toHaveBeenCalled();
    expect(f.privateReads.payouts).not.toHaveBeenCalled();
    expect(dto.sectionAccess).toMatchObject({
      journalView: true,
      journalUpdate: false,
      appointmentsView: false,
      reviewsView: false,
      payrollView: false,
    });
    expect(dto.appointments).toEqual([]);
    expect(dto.reviews?.items).toEqual([]);
  });

  it('the approved master template reads all four OWN sections for the linked employee only', async () => {
    const f = fixture([
      { section: 'journal', action: 'view', scope: 'OWN' },
      { section: 'appointments', action: 'view', scope: 'OWN' },
      { section: 'payroll', action: 'view', scope: 'OWN' },
      { section: 'reviews', action: 'view', scope: 'OWN' },
    ]);
    const dto = await selfGet(() => f.service.get(null, { date: '2026-10-18', month: '2026-10' })) as unknown as {
      sectionAccess?: Record<string, boolean>;
    };

    expect(f.privateReads.appointments).toHaveBeenCalled();
    expect(f.privateReads.reviewSummary).toHaveBeenCalled();
    expect(f.privateReads.reviewItems).toHaveBeenCalled();
    expect(f.privateReads.paySetting).toHaveBeenCalled();
    expect(f.privateReads.payPolicy).toHaveBeenCalled();
    expect(f.privateReads.payAdjustments).toHaveBeenCalled();
    expect(f.privateReads.payouts).toHaveBeenCalled();
    expect(dto.sectionAccess).toMatchObject({
      journalView: true,
      appointmentsView: true,
      reviewsView: true,
      payrollView: true,
    });
  });

  it('allows a linked employee with only payroll.view OWN to read only their pay section', async () => {
    const f = fixture([{ section: 'payroll', action: 'view', scope: 'OWN' }]);
    const dto = await selfGet(() => f.service.get(null, { date: '2026-10-18', month: '2026-10' })) as unknown as {
      sectionAccess?: Record<string, boolean>;
    };

    expect(f.privateReads.appointments).not.toHaveBeenCalled();
    expect(f.privateReads.reviewSummary).not.toHaveBeenCalled();
    expect(f.privateReads.reviewItems).not.toHaveBeenCalled();
    expect(f.privateReads.paySetting).toHaveBeenCalled();
    expect(f.privateReads.payPolicy).toHaveBeenCalled();
    expect(f.privateReads.payAdjustments).toHaveBeenCalled();
    expect(f.privateReads.payouts).toHaveBeenCalled();
    expect(dto.sectionAccess).toMatchObject({
      journalView: false,
      appointmentsView: false,
      reviewsView: false,
      payrollView: true,
    });
  });

  it('employees.view BUSINESS on a manager route does not expose another employee payroll, reviews or appointments', async () => {
    const f = fixture([{ section: 'employees', action: 'view', scope: 'BUSINESS' }]);
    const dto = await managerGet(() => f.service.get(otherEmployeeId, { date: '2026-10-18', month: '2026-10' })) as unknown as {
      sectionAccess?: Record<string, boolean>;
    };

    expect(f.privateReads.appointments).not.toHaveBeenCalled();
    expect(f.privateReads.reviewSummary).not.toHaveBeenCalled();
    expect(f.privateReads.reviewItems).not.toHaveBeenCalled();
    expect(f.privateReads.paySetting).not.toHaveBeenCalled();
    expect(f.privateReads.payPolicy).not.toHaveBeenCalled();
    expect(f.privateReads.payAdjustments).not.toHaveBeenCalled();
    expect(f.privateReads.payouts).not.toHaveBeenCalled();
    expect(dto.sectionAccess).toMatchObject({ employeesView: true, appointmentsView: false, reviewsView: false, payrollView: false });
  });

  it('OWN grants never authorize a manager projection of another employee', async () => {
    const f = fixture([
      { section: 'journal', action: 'view', scope: 'OWN' },
      { section: 'appointments', action: 'view', scope: 'OWN' },
      { section: 'payroll', action: 'view', scope: 'OWN' },
      { section: 'reviews', action: 'view', scope: 'OWN' },
    ]);
    await expect(managerGet(() => f.service.get(otherEmployeeId, {}))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('limits conflicts and review counts to the strict assigned branch', async () => {
    const f = fixture([
      { section: 'journal', action: 'view', scope: 'OWN' },
      { section: 'appointments', action: 'view', scope: 'OWN' },
      { section: 'reviews', action: 'view', scope: 'OWN' },
    ],locationId);
    f.privateReads.appointments.mockImplementation(async (args?:AppointmentReadArgs) => {
      if(!args?.where?.endsAt)return [];
      const locationScope=args.where.appointment?.locationId;
      const allowed=typeof locationScope==='string'?[locationScope]:locationScope?.in;
      return [
        {id:'line-a',startsAt:new Date('2026-10-19T09:00:00Z'),endsAt:new Date('2026-10-19T10:00:00Z'),service:{name:'Service A'},appointment:{locationId}},
        {id:'line-b',startsAt:new Date('2026-10-19T11:00:00Z'),endsAt:new Date('2026-10-19T12:00:00Z'),service:{name:'Service B'},appointment:{locationId:otherLocationId}},
      ].filter(row=>!allowed||allowed.includes(row.appointment.locationId));
    });

    const dto=await selfGet(()=>f.service.get(null,{date:'2026-10-18'}));

    expect(f.privateReads.reviewSummary).toHaveBeenCalledWith(expect.objectContaining({where:{employeeId,appointment:{locationId}}}));
    expect(f.privateReads.reviewItems).toHaveBeenCalledWith(expect.objectContaining({where:{employeeId,appointment:{locationId}}}));
    expect(dto.reviews).toMatchObject({averageStars:5,count:1,items:[expect.objectContaining({appointmentId:'visit-a'})]});
    expect(dto.scheduleConflicts.items.map(item=>item.locationId)).toEqual([locationId]);
  });

  it('intersects a business-wide position with the current MembershipScope branch',async()=>{
    const f=fixture([
      { section: 'journal', action: 'view', scope: 'OWN' },
      { section: 'appointments', action: 'view', scope: 'OWN' },
      { section: 'reviews', action: 'view', scope: 'OWN' },
    ]);
    f.privateReads.appointments.mockImplementation(async (args?:AppointmentReadArgs) => {
      if(!args?.where?.endsAt)return [];
      const locationScope=args.where.appointment?.locationId;
      const allowed=typeof locationScope==='string'?[locationScope]:locationScope?.in;
      return [
        {id:'line-a',startsAt:new Date('2026-10-19T09:00:00Z'),endsAt:new Date('2026-10-19T10:00:00Z'),service:{name:'Service A'},appointment:{locationId}},
        {id:'line-b',startsAt:new Date('2026-10-19T11:00:00Z'),endsAt:new Date('2026-10-19T12:00:00Z'),service:{name:'Service B'},appointment:{locationId:otherLocationId}},
      ].filter(row=>!allowed||allowed.includes(row.appointment.locationId));
    });
    const scopedActor={...actor(),scopes:[{role:'STAFF' as const,businessId,locationId}]};

    const dto=await withSignedInUser(scopedActor,()=>withVerifiedBeautyOperation(
      {section:'journal',action:'view',own:true,legacy:'self'},
      ()=>f.service.get(null,{date:'2026-10-18'}),
    ));

    expect(f.privateReads.reviewSummary).toHaveBeenCalledWith(expect.objectContaining({where:{employeeId,appointment:{locationId}}}));
    expect(dto.reviews.items.map(item=>item.appointmentId)).toEqual(['visit-a']);
    expect(dto.scheduleConflicts.items.map(item=>item.locationId)).toEqual([locationId]);
  });

  it('returns only assigned personal services when appointments.view OWN is not accompanied by services.view BUSINESS',async()=>{
    const f=fixture([{section:'appointments',action:'view',scope:'OWN'}],locationId);
    f.db.beautyService.findMany.mockResolvedValue([
      {id:'service-own',name:'Own service',durationMinutes:60,price:5000n,currency:'KZT',active:true,locations:[{enabled:true,priceOverride:null,durationOverride:null}],employeePrices:[]},
      {id:'service-other',name:'Catalog private',durationMinutes:90,price:9000n,currency:'KZT',active:true,locations:[{enabled:true,priceOverride:null,durationOverride:null}],employeePrices:[]},
    ]);
    f.db.employeeService.findMany.mockResolvedValue([{serviceId:'service-own'}]);

    const dto=await selfGet(()=>f.service.get(null,{date:'2026-10-18'}));

    expect(dto.services.map(service=>service.id)).toEqual(['service-own']);
  });
});
