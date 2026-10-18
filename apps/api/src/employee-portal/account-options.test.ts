import 'reflect-metadata';
import { ForbiddenException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import type { BeautyPositionAccess } from '@pms/domain';
import { describe, expect, it, vi } from 'vitest';
import { BEAUTY_ACCESS } from '../beauty/access.decorator';
import { withSignedInUser, withVerifiedBeautyOperation } from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';
import { EmployeePortalManagerController } from './employee-portal.module';
import { EmployeePortalService } from './employee-portal.service';

const organizationId='73000000-0000-4000-8000-000000000001';
const businessId='73000000-0000-4000-8000-000000000002';
const locationId='73000000-0000-4000-8000-000000000003';
const actorId='73000000-0000-4000-8000-000000000005';
const employeeId='73000000-0000-4000-8000-000000000006';
const otherEmployeeId='73000000-0000-4000-8000-000000000007';
const legacyUserId='73000000-0000-4000-8000-000000000008';
const strictUserId='73000000-0000-4000-8000-000000000009';
const revokedUserId='73000000-0000-4000-8000-000000000010';
const linkedUserId='73000000-0000-4000-8000-000000000011';

const actor={
  userId:actorId,organizationId,role:'MANAGER' as const,scope:'LOCATION' as const,
  businessId,locationId,vertical:'BEAUTY' as const,
};
const operation={section:'employees' as const,action:'update' as const,legacy:'staff' as const};
const snapshot:BeautyPositionAccess={
  mode:'ASSIGNED',assigned:true,
  permissions:[{section:'employees',action:'update',scope:'BUSINESS'}],
};
const location={id:locationId,businessId,name:'Synthetic branch',timezone:'UTC',currency:'USD',status:'ACTIVE'};
const targetEmployee={id:employeeId,businessId,userId:null,status:'ACTIVE',locations:[{location}]};
const actorAssignment={
  id:'actor-assignment',userId:actorId,organizationId,businessId,locationId:null,revokedAt:null,
  position:{archivedAt:null,permissions:[{section:'employees',action:'update',scope:'BUSINESS'}]},
};

type AccountOption={userId:string;email:string;name:string|null};
type AccountOptionsService={accountOptions(employeeId:string):Promise<AccountOption[]>};

const inManagerRequest=<T>(run:()=>Promise<T>)=>withSignedInUser(actor,()=>withVerifiedBeautyOperation(operation,run,snapshot));

function optionsFixture() {
  const membershipFindMany=vi.fn(async()=>[
    {userId:legacyUserId,role:'STAFF',user:{email:'legacy@example.test',name:'Legacy User'}},
    {userId:strictUserId,role:'STAFF',user:{email:'strict@example.test',name:'Strict User'}},
    {userId:revokedUserId,role:'STAFF',user:{email:'revoked@example.test',name:'Revoked User'}},
    {userId:linkedUserId,role:'STAFF',user:{email:'linked@example.test',name:'Linked User'}},
  ]);
  const employeeFindMany=vi.fn(async(args:{where?:{id?:string}})=>args.where?.id===employeeId
    ?[targetEmployee]
    :[{id:otherEmployeeId,businessId,userId:linkedUserId}]);
  const assignmentFindMany=vi.fn(async(args:{where?:{userId?:string|{in?:string[]}}})=>{
    if(args.where?.userId===actorId)return [actorAssignment];
    return [
      {id:'strict-active',userId:strictUserId,organizationId,businessId,locationId,revokedAt:null,position:{archivedAt:null,permissions:[]}},
      {id:'strict-revoked',userId:revokedUserId,organizationId,businessId,locationId,revokedAt:new Date('2026-10-18T00:00:00Z'),position:{archivedAt:null,permissions:[]}},
    ];
  });
  const db:Record<string,unknown>={
    business:{findFirst:vi.fn(async()=>({id:businessId,organizationId,vertical:'BEAUTY',status:'ACTIVE'}))},
    membership:{
      findFirst:vi.fn(async()=>({userId:actorId,organizationId,role:'MANAGER',status:'ACTIVE'})),
      findMany:membershipFindMany,
    },
    membershipScope:{findMany:vi.fn(async()=>[
      {userId:legacyUserId,role:'STAFF',businessId,locationId},
      {userId:strictUserId,role:'STAFF',businessId,locationId},
      {userId:revokedUserId,role:'STAFF',businessId,locationId},
      {userId:linkedUserId,role:'STAFF',businessId,locationId},
    ])},
    employee:{findMany:employeeFindMany},
    beautyPositionAssignment:{findMany:assignmentFindMany},
  };
  return {db,membershipFindMany,employeeFindMany,assignmentFindMany,service:new EmployeePortalService({db} as unknown as PrismaService,null)};
}

function revokedMutationFixture() {
  const write=vi.fn(async()=>{throw new Error('ACCOUNT_LINK_WRITE_REACHED');});
  const db:Record<string,unknown>={
    $transaction:vi.fn(async(fn:(tx:unknown)=>Promise<unknown>)=>fn(db)),
    $queryRaw:vi.fn(async()=>[{role:'MANAGER',status:'ACTIVE'}]),
    organization:{findUnique:vi.fn(async()=>({status:'ACTIVE',trialEndsAt:null}))},
    business:{findFirst:vi.fn(async()=>({id:businessId,organizationId,vertical:'BEAUTY',status:'ACTIVE'}))},
    membership:{findFirst:vi.fn(async(args:{where?:{userId?:string}})=>({
      userId:args.where?.userId??actorId,organizationId,role:'MANAGER',status:'ACTIVE',
    }))},
    membershipScope:{findMany:vi.fn(async(args:{where?:{userId?:string}})=>args.where?.userId===revokedUserId
      ?[{userId:revokedUserId,role:'STAFF',businessId,locationId}]
      :[])},
    employee:{
      findMany:vi.fn(async()=>[targetEmployee]),
      findUnique:vi.fn(async()=>({userId:null})),
      count:vi.fn(async()=>0),
      update:write,
    },
    employeePublicProfile:{findUnique:vi.fn(async()=>({employeeId,revision:1}))},
    beautyPositionAssignment:{findMany:vi.fn(async(args:{where?:{userId?:string|{in?:string[]}}})=>{
      const requested=typeof args.where?.userId==='string'?[args.where.userId]:args.where?.userId?.in??[];
      return requested.includes(revokedUserId)
        ?[{id:'revoked-only',userId:revokedUserId,organizationId,businessId,locationId,revokedAt:new Date('2026-10-18T00:00:00Z'),position:{archivedAt:null,permissions:[]}}]
        :[actorAssignment];
    })},
    auditLog:{create:vi.fn(async()=>({}))},
  };
  return {db,write,service:new EmployeePortalService({db} as unknown as PrismaService,null)};
}

describe('employee portal account options',()=>{
  it('exposes a scoped GET route guarded by employees.update',()=>{
    const handler=(EmployeePortalManagerController.prototype as unknown as Record<string,unknown>).accountOptions;
    expect(typeof handler).toBe('function');
    expect(Reflect.getMetadata(PATH_METADATA,handler as object)).toBe('account-options');
    expect(Reflect.getMetadata(METHOD_METADATA,handler as object)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(BEAUTY_ACCESS,handler as object)).toEqual({section:'employees',action:'update'});
  });

  it('returns verified active members allowed in the employee branch, applying strict retained assignments and excluding accounts linked elsewhere',async()=>{
    const f=optionsFixture();
    const service=f.service as unknown as AccountOptionsService;

    const rows=await inManagerRequest(()=>service.accountOptions(employeeId));

    expect(rows).toEqual([
      {userId:legacyUserId,email:'legacy@example.test',name:'Legacy User'},
      {userId:strictUserId,email:'strict@example.test',name:'Strict User'},
    ]);
    expect(f.membershipFindMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({
      organizationId,status:'ACTIVE',user:{status:'ACTIVE',emailVerifiedAt:{not:null}},
    })}));
    expect(f.employeeFindMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({businessId})}));
    expect(f.assignmentFindMany).toHaveBeenCalled();
  });

  it('rejects linking an account whose retained Beauty assignments are all revoked',async()=>{
    const f=revokedMutationFixture();

    await expect(inManagerRequest(()=>f.service.mutate(employeeId,'account',{userId:revokedUserId})))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(f.write).not.toHaveBeenCalled();
  });
});
