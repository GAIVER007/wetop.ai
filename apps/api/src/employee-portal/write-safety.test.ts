import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { EmployeePortalService } from './employee-portal.service';
import { PrismaService } from '../database/prisma.provider';
import { withSignedInUser } from '../auth/request-context';
const organizationId='00000000-0000-4000-8000-000000000001';
const businessId='00000000-0000-4000-8000-000000000002';
const userId='00000000-0000-4000-8000-000000000003';
const employeeId='00000000-0000-4000-8000-000000000004';
const actor={organizationId,businessId,userId,role:'OWNER' as const,scope:'BUSINESS' as const,vertical:'BEAUTY' as const};
function fixture(status:string,trialEndsAt:Date|null=null) {
  const db={
    organization:{findUnique:vi.fn(async()=>({status,trialEndsAt}))},
    business:{findFirst:vi.fn(async()=>({id:businessId,organizationId,vertical:'BEAUTY',status:'ACTIVE'}))},
    membership:{findFirst:vi.fn(async()=>({role:'OWNER'}))},
    employee:{findMany:vi.fn(async()=>[{id:employeeId,businessId,userId,status:'ACTIVE',locations:[]}]),update:vi.fn(async()=>({}))},
    employeePublicProfile:{upsert:vi.fn(async()=>({employeeId,revision:1}))},
    beautyPayrollPolicy:{findUnique:vi.fn(async()=>null),upsert:vi.fn(async()=>({percentBasis:'COMPLETED_SERVICES',revision:1}))},
    auditLog:{create:vi.fn(async()=>({}))},
    $queryRaw:vi.fn(async()=>[]),
    $transaction:async<T>(fn:(tx:unknown)=>Promise<T>)=>fn(db),
  };
  return {db,service:new EmployeePortalService({db} as unknown as PrismaService,null)};
}
describe('portal writes retain organization subscription restrictions',()=>{
  for(const [status,trialEndsAt] of [['READ_ONLY',null],['SUSPENDED',null],['TRIAL',new Date('2000-01-01T00:00:00Z')]] as const) {
    it(`rejects account unlink in ${status} before any write`,async()=>{
      const f=fixture(status,trialEndsAt);
      await expect(withSignedInUser(actor,()=>f.service.mutate(employeeId,'unlink-account',{}))).rejects.toThrow(ForbiddenException);
      expect(f.db.employee.update).not.toHaveBeenCalled();
      expect(f.db.auditLog.create).not.toHaveBeenCalled();
    });
    it(`rejects policy writes in ${status}`,async()=>{
      const f=fixture(status,trialEndsAt);
      await expect(withSignedInUser(actor,()=>f.service.setPolicy({percentBasis:'COMPLETED_SERVICES'}))).rejects.toThrow(ForbiddenException);
      expect(f.db.beautyPayrollPolicy.upsert).not.toHaveBeenCalled();
    });
  }
});
