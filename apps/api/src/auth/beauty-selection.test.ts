import { describe, expect, it, vi } from 'vitest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SharedOnboardingService } from '../onboarding/onboarding.module';
import { SiteFactsService } from '../marketing-site/site-facts.service';
import { ForbiddenException } from '@nestjs/common';
import { BranchesService } from '../hotel/branches';
import { withSignedInUser } from './request-context';
import { filterBeautyLocations } from '../beauty/access';
const actor = { userId:'user',organizationId:'org',role:'MANAGER' as const,scope:'LOCATION' as const,businessId:'salon-a',locationId:'branch-a',vertical:'BEAUTY' as const };
const rows = [
  {id:'branch-a',businessId:'salon-a',vertical:'BEAUTY',name:'Assigned salon'},
  {id:'branch-b',businessId:'salon-b',vertical:'BEAUTY',name:'Unassigned salon'},
  {id:'restaurant',businessId:'food',vertical:'FOOD_SERVICE',name:'Restaurant'},
];
function fixture(revoked=false) {
  return {db:{
    beautyPositionAssignment:{findMany:vi.fn().mockResolvedValue([{businessId:'salon-a',locationId:'branch-a',revokedAt:revoked?new Date():null,position:{archivedAt:null,permissions:[{section:'journal',action:'view',scope:'OWN'}]}}])},
    organization:{findUniqueOrThrow:vi.fn().mockResolvedValue({id:'org',name:'Synthetic'})},
    property:{findMany:vi.fn().mockResolvedValue([])},
    location:{findMany:vi.fn().mockResolvedValue(rows.map(row=>({...row,address:null,currency:'EUR',timezone:'UTC',business:{vertical:row.vertical}})))},
  }};
}

describe('Beauty assignments in identity and location selection',()=>{
  it('returns only the assigned Beauty branch and preserves other verticals',async()=>{
    const f=fixture();
    expect(await withSignedInUser(actor,()=>filterBeautyLocations(f.db as never,rows))).toEqual([rows[0],rows[2]]);
    const result=await withSignedInUser(actor,()=>new BranchesService(f as never).list());
    expect(result.items.map(row=>row.locationId)).toEqual(['branch-a','restaurant']);
  });
  it('does not restore salons after the final assignment is revoked',async()=>{
    const f=fixture(true);
    expect(await withSignedInUser(actor,()=>filterBeautyLocations(f.db as never,rows))).toEqual([rows[2]]);
  });
  it('projects only current position grants and resets an unassigned or revoked selection',async()=>{
    for (const change of [{}, {businessId:'salon-b',locationId:'branch-b'}, {revoked:true}]) {
      const f=fixture('revoked' in change);
      const selected={...actor,...change};
      const signed={user:{id:actor.userId,organizationId:actor.organizationId,role:actor.role}};
      const controller=new AuthController({whoami:async()=>signed} as never,{} as never,{} as never,{aiSeller:async()=>({access:'inactive'})} as never,f as never);
      const result=await withSignedInUser(selected,()=>controller.me({'x-wetop-session':'synthetic'}));
      expect(result).toHaveProperty('beautyAccess.mode','ASSIGNED');
      if('revoked' in change || 'businessId' in change) {
        expect(result).toHaveProperty('beautyAccess.assigned',false);
        expect(result).toHaveProperty('context.businessId',null);
      } else {
        expect(result).toHaveProperty('beautyAccess.permissions',[{section:'journal',action:'view',scope:'OWN'}]);
        expect(result).toHaveProperty('context.businessId','salon-a');
      }
    }
  });
  it('registration recovery chooses an assigned salon instead of the earliest unassigned salon', async () => {
    const f=fixture();
    const prisma={db:{...f.db,business:{findFirst:async()=>({id:'salon-b',name:'Unassigned',vertical:'BEAUTY'}),findMany:async()=>[
      {id:'salon-b',name:'Unassigned',vertical:'BEAUTY',locations:[{id:'branch-b',name:'Other'}]},
      {id:'salon-a',name:'Assigned',vertical:'BEAUTY',locations:[{id:'branch-a',name:'Own'}]},
    ]},location:{findFirst:async()=>({id:'branch-b',name:'Other'})}}};
    const auth=new AuthService(prisma as never,{} as never);
    expect(await withSignedInUser(actor,()=>auth.registrationContext('org',{role:'MANAGER'}))).toMatchObject({businessId:'salon-a',locationId:'branch-a'});
  });
  it('does not read onboarding drafts in an unassigned salon through a self route',async()=>{
    const f=fixture();
    const draft=vi.fn().mockRejectedValue(new Error('private draft read before authorization'));
    const prisma={db:{...f.db,location:{findFirst:async()=>({id:'branch-b',businessId:'salon-b',business:{vertical:'BEAUTY'}})},onboardingProgress:{findUnique:draft}}};
    await expect(withSignedInUser({...actor,businessId:'salon-b',locationId:'branch-b'},()=>new SharedOnboardingService(prisma as never).status())).rejects.toBeInstanceOf(ForbiddenException);
    expect(draft).not.toHaveBeenCalled();
  });
  it('does not authorize a website target in an unassigned Beauty salon from a query parameter',async()=>{
    const f=fixture();
    const target='11111111-1111-4111-8111-111111111111';
    const prisma={db:{...f.db,location:{findFirst:async()=>({id:target,businessId:'salon-b',business:{vertical:'BEAUTY'}})}}};
    await expect(withSignedInUser(actor,()=>new SiteFactsService(prisma as never).target(target))).rejects.toThrow();
  });

});
