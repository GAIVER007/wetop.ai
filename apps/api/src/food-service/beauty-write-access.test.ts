import { describe, expect, it, vi } from 'vitest';
import { foodTransaction, type FoodScope } from './scope';
import { withSignedInUser, withVerifiedBeautyOperation } from '../auth/request-context';

const scope: FoodScope={organizationId:'org',businessId:'salon',locationId:'branch',timezone:'UTC',currency:'USD',vertical:'BEAUTY'};
const actor={userId:'staff',organizationId:'org',role:'MANAGER' as const,scope:'LOCATION' as const,businessId:'salon',locationId:'branch',vertical:'BEAUTY' as const};
function setup(revoked:boolean) {
  const tx={
    $queryRaw:vi.fn(async(parts:TemplateStringsArray)=>parts.join(' ').includes('memberships')?[{role:'MANAGER',status:'ACTIVE'}]:[]),
    membershipScope:{findMany:vi.fn().mockResolvedValue([])},
    organization:{findUnique:vi.fn().mockResolvedValue({status:'ACTIVE',trialEndsAt:null})},
    business:{findFirst:vi.fn().mockResolvedValue({id:'salon'})},
    location:{findFirst:vi.fn().mockResolvedValue({id:'branch',timezone:'UTC',currency:'USD'})},
    beautyPositionAssignment:{findMany:vi.fn().mockResolvedValue([{businessId:'salon',locationId:'branch',revokedAt:revoked?new Date():null,position:{archivedAt:null,permissions:[{section:'finance',action:'create',scope:'BUSINESS'}]}}])},
  };
  return {tx,prisma:{db:{$transaction:vi.fn((fn:(tx:unknown)=>unknown)=>fn(tx))}}};
}
describe('Beauty shared cash transaction revalidation',()=>{
  it('rejects a cashier whose assignment was revoked after route authorization before any cash write',async()=>{
    const f=setup(true),write=vi.fn().mockResolvedValue('posted');
    await expect(withSignedInUser(actor,()=>withVerifiedBeautyOperation({section:'finance',action:'create',legacy:'desk'},()=>foodTransaction(f.prisma as never,scope,write,['BEAUTY'])))).rejects.toThrow();
    expect(write).not.toHaveBeenCalled();
  });
  it('permits an active explicit cashier grant and serializes against position changes on the business',async()=>{
    const f=setup(false),write=vi.fn().mockResolvedValue('posted');
    expect(await withSignedInUser(actor,()=>withVerifiedBeautyOperation({section:'finance',action:'create',legacy:'desk'},()=>foodTransaction(f.prisma as never,scope,write,['BEAUTY'])))).toBe('posted');
    expect(f.tx.beautyPositionAssignment.findMany).toHaveBeenCalled();
    const queries=f.tx.$queryRaw.mock.calls.map(call=>String.raw({raw:call[0] as unknown as readonly string[]}));
    expect(queries.some(sql=>sql.includes('businesses')&&sql.includes('FOR UPDATE'))).toBe(true);
  });
});
