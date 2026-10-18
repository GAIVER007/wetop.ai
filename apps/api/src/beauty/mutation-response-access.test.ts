import { describe, expect, it, vi } from 'vitest';
import { BeautyAppointmentsService } from './appointments';
import { withSignedInUser, withVerifiedBeautyOperation } from '../auth/request-context';

it.each(['create', 'refund'] as const)('does not leak the journal or client list in a finance.%s response without view access',async(action)=>{
  const readAppointments=vi.fn().mockResolvedValue([]),readEmployees=vi.fn().mockResolvedValue([]);
  const db={
    business:{findFirst:vi.fn().mockResolvedValue({id:'salon'})},
    location:{findFirst:vi.fn().mockResolvedValue({id:'branch',name:'Test salon',timezone:'UTC',currency:'USD'})},
    beautyPositionAssignment:{findMany:vi.fn().mockResolvedValue([{businessId:'salon',locationId:'branch',revokedAt:null,position:{archivedAt:null,permissions:[{section:'finance',action,scope:'BUSINESS'}]}}])},
    appointment:{findMany:readAppointments},employee:{findMany:readEmployees},beautyService:{findMany:vi.fn().mockResolvedValue([])},employeeServicePrice:{findMany:vi.fn().mockResolvedValue([])},beautyLocationHours:{findUnique:vi.fn().mockResolvedValue(null)},
  };
  const result=await withSignedInUser({userId:'cashier',organizationId:'org',role:'MANAGER',scope:'LOCATION',businessId:'salon',locationId:'branch',vertical:'BEAUTY'},()=>withVerifiedBeautyOperation({section:'finance',action,legacy:action==='refund'?'refunds':'desk'},()=>new BeautyAppointmentsService({db} as never).day('2026-10-18')));
  expect(result.appointments).toEqual([]);
  expect(result.columns).toEqual([]);
  expect(result.services).toEqual([]);
  expect(readAppointments).not.toHaveBeenCalled();
  expect(readEmployees).not.toHaveBeenCalled();
});
