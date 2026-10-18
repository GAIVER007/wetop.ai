import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import type { BeautyPermission, BeautyPositionAccess } from '@pms/domain';
import { describe, expect, it, vi } from 'vitest';
import { withSignedInUser, withVerifiedBeautyOperation, type VerifiedBeautyOperation } from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';
import { PrismaBarRepository } from './bar.repository';

const organizationId='71000000-0000-4000-8000-000000000001';
const businessId='71000000-0000-4000-8000-000000000002';
const locationId='71000000-0000-4000-8000-000000000003';
const userId='71000000-0000-4000-8000-000000000004';
const productId='71000000-0000-4000-8000-000000000005';
const saleId='71000000-0000-4000-8000-000000000006';
const lotId='71000000-0000-4000-8000-000000000007';

type TestActor={
  userId:string;organizationId:string;role:'MANAGER';scope:'BUSINESS'|'LOCATION';businessId:string;
  locationId?:string;vertical:'BEAUTY';scopes:Array<{role:'MANAGER'|'STAFF';businessId:string;locationId:string|null}>;
};
const actor:TestActor={userId,organizationId,role:'MANAGER',scope:'LOCATION',businessId,locationId,vertical:'BEAUTY',scopes:[{role:'MANAGER',businessId,locationId}]};
const snapshot=(permissions:BeautyPermission[]):BeautyPositionAccess=>({mode:'ASSIGNED',assigned:true,permissions});

function fixture(
  currentPermissions:BeautyPermission[],
  revokedAt:Date|string|null=null,
  options:{sale?:boolean;liveScopes?:Array<{role:'MANAGER'|'STAFF';businessId:string;locationId:string|null}>}={},
) {
  const writes={
    category:vi.fn(async()=>({id:'category-new',name:'Расходники',defaultMarkupBasis:1500})),
    cash:vi.fn(async()=>({id:'cash-new'})),
    cashUpdate:vi.fn(async()=>({})),
    sale:vi.fn(async()=>({id:'sale-new'})),
    saleUpdate:vi.fn(async()=>({})),
    lot:vi.fn(async()=>({})),
    movement:vi.fn(async()=>({})),
    audit:vi.fn(async()=>({})),
  };
  const propertyLookup=vi.fn(async()=>null);
  const db={
    $transaction:vi.fn(async(fn:(tx:unknown)=>Promise<unknown>)=>fn(db)),
    $queryRaw:vi.fn(async(sql:TemplateStringsArray)=>{
      const query=sql.join(' ');
      if(query.includes('memberships')) return [{role:'MANAGER',status:'ACTIVE'}];
      return query.includes('SELECT currency FROM locations')?[{currency:'KZT'}]:[{id:locationId}];
    }),
    membershipScope:{findMany:vi.fn(async()=>options.liveScopes??[{role:'MANAGER',businessId,locationId}])},
    location:{findFirst:vi.fn(async()=>({id:locationId,timezone:'Asia/Almaty',currency:'KZT',business:{vertical:'BEAUTY'},property:null}))},
    property:{findFirst:propertyLookup},
    organization:{findUnique:vi.fn(async()=>({status:'ACTIVE',trialEndsAt:null}))},
    business:{findFirst:vi.fn(async()=>({id:businessId,organizationId,status:'ACTIVE',vertical:'BEAUTY'}))},
    beautyPositionAssignment:{findMany:vi.fn(async()=>[{userId,organizationId,businessId,locationId:null,revokedAt,position:{archivedAt:null,permissions:currentPermissions}}])},
    barCategory:{create:writes.category},
    barSale:{
      findFirst:vi.fn(async()=>options.sale?{
        id:saleId,status:'POSTED',cashOperationId:null,restaurantCashOperationId:'cash-operation',chargeId:null,
      }:null),
      create:writes.sale,
      update:writes.saleUpdate,
    },
    barProduct:{findFirst:vi.fn(async()=>({id:productId,name:'Synthetic product',salePrice:500n}))},
    barStockLot:{findMany:vi.fn(async()=>[{id:'lot-one',receivedAt:new Date('2026-10-01T00:00:00Z'),remainingUnits:10n,unitCost:300n}]),update:writes.lot},
    barStockMovement:{
      findMany:vi.fn(async()=>[{lotId,productId,units:-2n,unitCost:300n}]),
      create:writes.movement,
    },
    restaurantCashOperation:{create:writes.cash,update:writes.cashUpdate},
    auditLog:{create:writes.audit},
  };
  return {repository:new PrismaBarRepository({db} as unknown as PrismaService),writes,propertyLookup};
}

async function asBeautyWrite<T>(
  operation:VerifiedBeautyOperation,
  initial:BeautyPermission[],
  run:()=>Promise<T>,
  acting:TestActor=actor,
) {
  return withSignedInUser(acting,()=>withVerifiedBeautyOperation(operation,run,snapshot(initial)));
}

describe('Beauty bar write authorization at transaction time',()=>{
  it('rejects a catalog write when the position was revoked after route authorization',async()=>{
    const permission={section:'stock',action:'create',scope:'BUSINESS'} as const;
    const f=fixture([permission],new Date('2026-10-18T08:00:00Z'));

    await expect(asBeautyWrite(
      {section:'stock',action:'create',legacy:'settings'},[permission],
      ()=>f.repository.createCategory({name:'Расходники',defaultMarkupBasis:1500}),
    )).rejects.toBeInstanceOf(ForbiddenException);

    expect(f.writes.category).not.toHaveBeenCalled();
    expect(f.writes.audit).not.toHaveBeenCalled();
  });

  it('revalidates every section of a compound stock and finance sale before either write',async()=>{
    const stock={section:'stock',action:'create',scope:'BUSINESS'} as const;
    const finance={section:'finance',action:'create',scope:'BUSINESS'} as const;
    const f=fixture([stock]);

    await expect(asBeautyWrite(
      {section:'stock',action:'create',legacy:'desk',also:[{section:'finance',action:'create'}]},[stock,finance],
      ()=>f.repository.sellRetail({productId,quantityUnits:1n,method:'CASH',idempotencyKey:'synthetic-sale-key'}),
    )).rejects.toBeInstanceOf(ForbiddenException);

    expect(f.writes.cash).not.toHaveBeenCalled();
    expect(f.writes.sale).not.toHaveBeenCalled();
    expect(f.writes.lot).not.toHaveBeenCalled();
    expect(f.writes.movement).not.toHaveBeenCalled();
    expect(f.writes.audit).not.toHaveBeenCalled();
  });

  it('rejects a Beauty business scope without a branch before property lookup or writes',async()=>{
    const stock={section:'stock',action:'create',scope:'BUSINESS'} as const;
    const businessActor:TestActor={
      userId,organizationId,role:'MANAGER',scope:'BUSINESS',businessId,vertical:'BEAUTY',
      scopes:[{role:'MANAGER',businessId,locationId:null}],
    };
    const f=fixture([stock],null,{liveScopes:businessActor.scopes});

    await expect(asBeautyWrite(
      {section:'stock',action:'create',legacy:'settings'},[stock],
      ()=>f.repository.createCategory({name:'Расходники',defaultMarkupBasis:1500}),
      businessActor,
    )).rejects.toBeInstanceOf(ForbiddenException);

    expect(f.propertyLookup).not.toHaveBeenCalled();
    expect(f.writes.category).not.toHaveBeenCalled();
    expect(f.writes.audit).not.toHaveBeenCalled();
  });

  it('requires stock update permission when a refund restores inventory',async()=>{
    const refund={section:'finance',action:'refund',scope:'BUSINESS'} as const;
    const f=fixture([refund],null,{sale:true});

    await expect(asBeautyWrite(
      {section:'finance',action:'refund',legacy:'refunds'},[refund],
      ()=>f.repository.reverseSale(saleId,true,'Synthetic return'),
    )).rejects.toBeInstanceOf(ForbiddenException);

    expect(f.writes.lot).not.toHaveBeenCalled();
    expect(f.writes.movement).not.toHaveBeenCalled();
    expect(f.writes.cashUpdate).not.toHaveBeenCalled();
    expect(f.writes.saleUpdate).not.toHaveBeenCalled();
    expect(f.writes.audit).not.toHaveBeenCalled();
  });

  it('allows a refund without restock using finance refund permission alone',async()=>{
    const refund={section:'finance',action:'refund',scope:'BUSINESS'} as const;
    const f=fixture([refund],null,{sale:true});

    await expect(asBeautyWrite(
      {section:'finance',action:'refund',legacy:'refunds'},[refund],
      ()=>f.repository.reverseSale(saleId,false,'Synthetic return without goods'),
    )).resolves.toMatchObject({kind:'reversed',restocked:false});

    expect(f.writes.lot).not.toHaveBeenCalled();
    expect(f.writes.movement).not.toHaveBeenCalled();
    expect(f.writes.cashUpdate).toHaveBeenCalledOnce();
    expect(f.writes.saleUpdate).toHaveBeenCalledOnce();
    expect(f.writes.audit).toHaveBeenCalledOnce();
  });

  it('allows restock when the position has refund and stock update permissions',async()=>{
    const refund={section:'finance',action:'refund',scope:'BUSINESS'} as const;
    const stock={section:'stock',action:'update',scope:'BUSINESS'} as const;
    const f=fixture([refund,stock],null,{sale:true});

    await expect(asBeautyWrite(
      {section:'finance',action:'refund',legacy:'refunds'},[refund,stock],
      ()=>f.repository.reverseSale(saleId,true,'Synthetic return with goods'),
    )).resolves.toMatchObject({kind:'reversed',restocked:true});

    expect(f.writes.lot).toHaveBeenCalledOnce();
    expect(f.writes.movement).toHaveBeenCalledOnce();
    expect(f.writes.cashUpdate).toHaveBeenCalledOnce();
    expect(f.writes.saleUpdate).toHaveBeenCalledOnce();
    expect(f.writes.audit).toHaveBeenCalledOnce();
  });
});
