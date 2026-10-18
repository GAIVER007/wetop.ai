import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { BeautyReviewsService } from './reviews';
import { withSignedInUser, withVerifiedBeautyOperation } from '../auth/request-context';

const actor={userId:'administrator',organizationId:'org',role:'STAFF' as const,scope:'LOCATION' as const,businessId:'salon',locationId:'branch',vertical:'BEAUTY' as const};
const grant={section:'reviews',action:'create',scope:'BUSINESS'} as const;
const service=(permissions:unknown[])=>new BeautyReviewsService({db:{beautyPositionAssignment:{findMany:vi.fn().mockResolvedValue([{businessId:'salon',locationId:'branch',revokedAt:null,position:{archivedAt:null,permissions}}])}}} as never);
describe('review invitation uses the administrator position permission',()=>{
  it('accepts an explicit custom administrator grant before validating the visit',async()=>{
    await expect(withSignedInUser(actor,()=>withVerifiedBeautyOperation({section:'reviews',action:'create',legacy:'staff'},()=>service([grant]).issue('invalid-visit')))).rejects.toBeInstanceOf(NotFoundException);
  });
  it('rejects a position without the explicit grant before reading a visit',async()=>{
    await expect(withSignedInUser({...actor,role:'MANAGER'},()=>withVerifiedBeautyOperation({section:'reviews',action:'create',legacy:'staff'},()=>service([]).issue('invalid-visit')))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
