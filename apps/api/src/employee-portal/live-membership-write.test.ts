import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import type { BeautyPositionAccess } from '@pms/domain';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import { withSignedInUser, withVerifiedBeautyOperation, type VerifiedBeautyOperation } from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';
import type { SiteAssetStorage } from '../marketing-site/asset-storage';
import { EmployeePortalService } from './employee-portal.service';

const organizationId='74000000-0000-4000-8000-000000000001';
const businessId='74000000-0000-4000-8000-000000000002';
const locationId='74000000-0000-4000-8000-000000000003';
const otherBusinessId='74000000-0000-4000-8000-000000000004';
const actorId='74000000-0000-4000-8000-000000000005';
const employeeId='74000000-0000-4000-8000-000000000006';

const actor={
  userId:actorId,organizationId,role:'MANAGER' as const,scope:'LOCATION' as const,
  businessId,locationId,vertical:'BEAUTY' as const,
  scopes:[{role:'MANAGER' as const,businessId,locationId}],
};
const location={id:locationId,businessId,name:'Synthetic branch',timezone:'UTC',currency:'USD',status:'ACTIVE'};
const employee={id:employeeId,businessId,userId:null,status:'ACTIVE',locations:[{location}]};

function fixture() {
  const mediaWrite=vi.fn(async()=>{throw new Error('MEDIA_WRITE_REACHED');});
  const policyWrite=vi.fn(async()=>{throw new Error('POLICY_WRITE_REACHED');});
  const db:Record<string,unknown>={
    $transaction:vi.fn(async(fn:(tx:unknown)=>Promise<unknown>)=>fn(db)),
    $queryRaw:vi.fn(async()=>[{role:'MANAGER',status:'ACTIVE'}]),
    organization:{findUnique:vi.fn(async()=>({status:'ACTIVE',trialEndsAt:null}))},
    business:{findFirst:vi.fn(async()=>({id:businessId,organizationId,vertical:'BEAUTY',status:'ACTIVE'}))},
    membership:{findFirst:vi.fn(async()=>({userId:actorId,organizationId,role:'MANAGER',status:'ACTIVE'}))},
    membershipScope:{findMany:vi.fn(async()=>[{userId:actorId,role:'MANAGER',businessId:otherBusinessId,locationId:null}])},
    beautyPositionAssignment:{findMany:vi.fn(async()=>[{
      id:'active-position',userId:actorId,organizationId,businessId,locationId:null,revokedAt:null,
      position:{archivedAt:null,permissions:[
        {section:'employees',action:'update',scope:'BUSINESS'},
        {section:'payroll',action:'update',scope:'BUSINESS'},
      ]},
    }])},
    employee:{findMany:vi.fn(async()=>[employee])},
    employeeMedia:{findFirst:vi.fn(async()=>null),deleteMany:vi.fn(async()=>({count:0})),create:mediaWrite},
    employeePublicProfile:{findUnique:vi.fn(async()=>({employeeId,revision:1}))},
    beautyPayrollPolicy:{findUnique:vi.fn(async()=>null),upsert:policyWrite},
    auditLog:{create:vi.fn(async()=>({}))},
  };
  const storage={
    put:vi.fn(async()=>undefined),delete:vi.fn(async()=>undefined),signedGet:vi.fn(async()=>''),
  } as unknown as SiteAssetStorage;
  return {service:new EmployeePortalService({db} as unknown as PrismaService,storage),mediaWrite,policyWrite};
}

const access:BeautyPositionAccess={
  mode:'ASSIGNED',assigned:true,
  permissions:[
    {section:'employees',action:'update',scope:'BUSINESS'},
    {section:'payroll',action:'update',scope:'BUSINESS'},
  ],
};
const inRequest=<T>(operation:VerifiedBeautyOperation,run:()=>Promise<T>)=>
  withSignedInUser(actor,()=>withVerifiedBeautyOperation(operation,run,access));

describe('employee portal live membership write authorization',()=>{
  it('rejects an avatar upload when the actor membership scope changed after route authorization',async()=>{
    const f=fixture();
    const png=await sharp({create:{width:1,height:1,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).png().toBuffer();

    await expect(inRequest(
      {section:'employees',action:'update',legacy:'staff'},
      ()=>f.service.upload(employeeId,'AVATAR',{buffer:png},{}),
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.mediaWrite).not.toHaveBeenCalled();
  });

  it('rejects a payroll policy update when the actor membership scope changed after route authorization',async()=>{
    const f=fixture();

    await expect(inRequest(
      {section:'payroll',action:'update',legacy:'staff'},
      ()=>f.service.setPolicy({percentBasis:'COMPLETED_SERVICES'}),
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.policyWrite).not.toHaveBeenCalled();
  });
});
