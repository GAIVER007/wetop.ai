import { BranchCashController, BranchPayrollController } from '../food-service/food.module';
import { BarController } from '../bar/bar.controller';
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { PUBLIC_ROUTE } from '../auth/public.decorator';
import { EmployeePortalController, EmployeePortalManagerController, EmployeePortalSelfController } from '../employee-portal/employee-portal.module';
import { FinanceController } from '../finance/finance.controller';
import { BEAUTY_ACCESS, type BeautyRequirement } from './access.decorator';
import { BeautyAppointmentHistoryController } from './appointment-history';
import { BeautyAppointmentsController } from './appointments';
import { BeautyCatalogController } from './beauty.module';
import { BeautyCustomerDetailController } from './customer-detail';
import { BeautyCustomerImportController } from './customer-import';
import { BeautyLocationHoursController } from './location-hours';
import { BeautyLoyaltyController } from './loyalty';
import { BeautyRemindersController } from './reminders';
import { BeautyPublicReviewsController, BeautyReviewInvitationController } from './reviews';
import { BeautyScheduleController } from './schedule';

type ControllerClass = { prototype: object };

const controllerName = (controller: ControllerClass) =>
  (controller as { name?: string }).name ?? 'Controller';

const requirement = (controller: ControllerClass, method: string) =>
  Reflect.getMetadata(
    BEAUTY_ACCESS,
    (controller.prototype as Record<string, unknown>)[method] as object,
  ) as BeautyRequirement | undefined;

const expectRoutes = (
  controller: ControllerClass,
  routes: Record<string, BeautyRequirement>,
  exhaustive = true,
) => {
  if (exhaustive) {
    expect(
      Object.getOwnPropertyNames(controller.prototype).filter((method) => method !== 'constructor').sort(),
      `${controllerName(controller)} route inventory`,
    ).toEqual(Object.keys(routes).sort());
  }
  for (const [method, expected] of Object.entries(routes)) {
    expect(requirement(controller, method), `${controllerName(controller)}.${method}`).toEqual(expected);
  }
};

describe('Beauty route action metadata', () => {
  it('classifies every authenticated Beauty controller action', () => {
    expectRoutes(BeautyAppointmentsController, {
      day: { section: 'journal', action: 'view' },
      financeDay: { section: 'finance', action: 'view' },
      financePeriod: { section: 'finance', action: 'view' },
      period: { section: 'appointments', action: 'view' },
      create: { section: 'appointments', action: 'create' },
      move: { section: 'appointments', action: 'update' },
      setStatus: { section: 'appointments', action: 'update' },
      pay: { section: 'finance', action: 'create' },
      refund: { section: 'finance', action: 'refund' },
    });
    expectRoutes(BeautyAppointmentHistoryController, {
      history: { section: 'appointments', action: 'view' },
    });
    expectRoutes(BeautyCustomerImportController, {
      preview: { section: 'customers', action: 'create' },
      apply: { section: 'customers', action: 'create' },
    });
    expectRoutes(BeautyCustomerDetailController, {
      detail: { section: 'customers', action: 'view' },
    });
    expectRoutes(BeautyCatalogController, {
      customers: { section: 'customers', action: 'view' },
      createCustomer: { section: 'customers', action: 'create' },
      updateCustomer: { section: 'customers', action: 'update' },
      services: { section: 'services', action: 'view' },
      createService: { section: 'services', action: 'create' },
      updateService: { section: 'services', action: 'update' },
      setLocationService: { section: 'services', action: 'update' },
      serviceMaterials: { section: 'services', action: 'view' },
      setServiceMaterials: { section: 'services', action: 'update' },
      employees: { section: 'employees', action: 'view' },
      assignPersonnelKind: { section: 'employees', action: 'update' },
      createEmployee: { section: 'employees', action: 'create' },
      updateEmployee: { section: 'employees', action: 'update' },
      setEmployeeServices: { section: 'employees', action: 'update' },
      employeeServicePrices: { section: 'services', action: 'view' },
      setEmployeeServicePrice: { section: 'services', action: 'update' },
      removeEmployeeServicePrice: { section: 'services', action: 'update' },
    });
    expectRoutes(BeautyScheduleController, {
      schedule: { section: 'journal', action: 'view' },
      setWorkingHours: { section: 'journal', action: 'update' },
      addTimeOff: { section: 'journal', action: 'update' },
      removeTimeOff: { section: 'journal', action: 'update' },
      setLocations: { section: 'employees', action: 'update' },
    });
    expectRoutes(BeautyLocationHoursController, {
      get: { section: 'settings', action: 'view' },
      save: { section: 'settings', action: 'update' },
    });
    expectRoutes(BeautyReviewInvitationController, {
      issue: { section: 'reviews', action: 'create' },
    });
    expectRoutes(BeautyRemindersController, {
      settings: { section: 'settings', action: 'view' },
      saveSettings: { section: 'settings', action: 'update' },
      day: { section: 'journal', action: 'view' },
      done: { section: 'appointments', action: 'update' },
    });
    expectRoutes(BeautyLoyaltyController, {
      program: { section: 'settings', action: 'view' },
      saveProgram: { section: 'settings', action: 'update' },
      customerBonuses: { section: 'customers', action: 'view' },
      adjust: { section: 'customers', action: 'update', managerOnly: true },
      certificates: { section: 'finance', action: 'view' },
      lookup: { section: 'finance', action: 'view' },
      sell: { section: 'finance', action: 'create' },
    });
  });

  it('keeps anonymous review submission public and outside employee permissions', () => {
    expect(Reflect.getMetadata(PUBLIC_ROUTE, BeautyPublicReviewsController)).toBe(true);
    expect(requirement(BeautyPublicReviewsController, 'read')).toBeUndefined();
    expect(requirement(BeautyPublicReviewsController, 'submit')).toBeUndefined();
  });

  it('classifies shared cash actions without enabling hospitality folio routes for Beauty', () => {
    expectRoutes(FinanceController, {
      operations: { section: 'finance', action: 'view' },
      cashflow: { section: 'finance', action: 'view' },
      cash: { section: 'finance', action: 'view' },
      cashCategories: { section: 'finance', action: 'view' },
      createCashCategory: { section: 'finance', action: 'create' },
      updateCashCategory: { section: 'finance', action: 'update' },
      createCashOperation: { section: 'finance', action: 'create' },
      createCashTransfer: { section: 'finance', action: 'create' },
      createCashReconciliation: { section: 'finance', action: 'create' },
      voidCashOperation: { section: 'finance', action: 'refund' },
    }, false);
    for (const method of ['reservation', 'report', 'servicesReport', 'debts', 'services', 'addCharge', 'addStayExtra', 'closeFolio', 'voidCharge', 'createPayment', 'issueReceipt', 'voidPayment', 'replacePayment', 'refund']) {
      expect(requirement(FinanceController, method), `FinanceController.${method}`).toBeUndefined();
    }
  });

  it('classifies manager and self employee portal actions without widening legacy access', () => {
    expectRoutes(EmployeePortalManagerController, {
      get: { section: 'employees', action: 'view' },
      accountOptions: { section: 'employees', action: 'update' },
      profile: { section: 'employees', action: 'update' },
      deleteAvatar: { section: 'employees', action: 'update' },
      work: { section: 'employees', action: 'update' },
      deleteWork: { section: 'employees', action: 'update' },
      publication: { section: 'employees', action: 'update' },
      services: { section: 'employees', action: 'update' },
      week: { section: 'employees', action: 'update' },
      timeOff: { section: 'employees', action: 'update' },
      deleteTimeOff: { section: 'employees', action: 'update' },
      account: { section: 'employees', action: 'update' },
      unlinkAccount: { section: 'employees', action: 'update' },
      paySettings: { section: 'payroll', action: 'update' },
      avatar: { section: 'employees', action: 'update' },
      portfolio: { section: 'employees', action: 'update' },
    });
    expectRoutes(EmployeePortalSelfController, {
      get: { section: 'journal', action: 'view', own: true, anyOf: ['appointments', 'payroll', 'reviews'] },
      profile: { section: 'journal', action: 'update', own: false },
      deleteAvatar: { section: 'journal', action: 'update', own: false },
      work: { section: 'journal', action: 'update', own: false },
      deleteWork: { section: 'journal', action: 'update', own: false },
      services: { section: 'journal', action: 'update', own: false },
      week: { section: 'journal', action: 'update', own: false },
      timeOff: { section: 'journal', action: 'update', own: false },
      deleteTimeOff: { section: 'journal', action: 'update', own: false },
      avatar: { section: 'journal', action: 'update', own: false },
      portfolio: { section: 'journal', action: 'update', own: false },
    });
    expectRoutes(EmployeePortalController, {
      policy: { section: 'payroll', action: 'update' },
    }, false);
  });
  it('classifies the actual Beauty branch cash, payroll and warehouse endpoints',()=>{
    expectRoutes(BranchCashController,{cash:{section:'finance',action:'view'},staffRevenue:{section:'finance',action:'view'},cashOperation:{section:'finance',action:'create'},voidCashOperation:{section:'finance',action:'refund'},cashReconciliation:{section:'finance',action:'update'}});
    expectRoutes(BranchPayrollController,{payroll:{section:'payroll',action:'view'},paySettings:{section:'payroll',action:'update'},payAdjustment:{section:'payroll',action:'update'},payout:{section:'payroll',action:'create',also:[{section:'finance',action:'create'}]}});
    expectRoutes(BarController,{paymentMethods:{section:'stock',action:'view'},stock:{section:'stock',action:'view'},products:{section:'stock',action:'view'},createProduct:{section:'stock',action:'create'},updateProduct:{section:'stock',action:'update'},writeOff:{section:'stock',action:'update'},inventoryCount:{section:'stock',action:'update'},sellRetail:{section:'stock',action:'create',also:[{section:'finance',action:'create'}]},reverseSale:{section:'finance',action:'refund'}}, false);
    expect(requirement(BarController,'folios')).toBeUndefined();
    expect(requirement(BarController,'sellToFolio')).toBeUndefined();
  });

});
