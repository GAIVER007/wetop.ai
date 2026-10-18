import 'reflect-metadata';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { Access } from './access.decorator';
import { BeautyAccess } from '../beauty/access.decorator';
import { AuthorInterceptor } from './author.interceptor';
import { RoleGuard } from './role.guard';
import { actorMay, currentBeautyOperation } from './request-context';

const B = '11111111-1111-4111-8111-111111111111', L = '22222222-2222-4222-8222-222222222222';
class Routes { refund() {} unknown() {} owner() {} personal() {} stockSale() {} }
Access('refunds')(Routes.prototype, 'refund', Object.getOwnPropertyDescriptor(Routes.prototype, 'refund')!);
BeautyAccess('finance', 'refund')(Routes.prototype, 'refund', Object.getOwnPropertyDescriptor(Routes.prototype, 'refund')!);
Access('desk')(Routes.prototype, 'unknown', Object.getOwnPropertyDescriptor(Routes.prototype, 'unknown')!);
Access('owner')(Routes.prototype, 'owner', Object.getOwnPropertyDescriptor(Routes.prototype, 'owner')!);
Access('self')(Routes.prototype,'personal',Object.getOwnPropertyDescriptor(Routes.prototype,'personal')!);
BeautyAccess('journal','view',{own:true,anyOf:['appointments','payroll','reviews']})(Routes.prototype,'personal',Object.getOwnPropertyDescriptor(Routes.prototype,'personal')!);
Access('desk')(Routes.prototype,'stockSale',Object.getOwnPropertyDescriptor(Routes.prototype,'stockSale')!);
BeautyAccess('stock','create',{also:[{section:'finance',action:'create'}]})(Routes.prototype,'stockSale',Object.getOwnPropertyDescriptor(Routes.prototype,'stockSale')!);
function context(method: keyof Routes = 'refund', role = 'STAFF') {
  return { getHandler: () => Routes.prototype[method], getClass: () => Routes, switchToHttp: () => ({ getRequest: () => ({ user: { id: 'user', organizationId: 'org', role }, headers: { 'x-wetop-scope': `business=${B};location=${L}` } }) }) } as unknown as ExecutionContext;
}
function fixture(grants: Array<{section: string; action: string; scope: string}>, options: { legacy?: boolean; revoked?: boolean; vertical?: string } = {}) {
  return { db: { business: { findFirst: vi.fn().mockResolvedValue({ id: B, vertical: options.vertical ?? 'BEAUTY' }) }, location: { findFirst: vi.fn().mockResolvedValue({ id: L }) }, beautyPositionAssignment: { findMany: vi.fn().mockResolvedValue(options.legacy ? [] : [{ businessId: B, locationId: L, revokedAt: options.revoked ? new Date() : null, position: { archivedAt: null, permissions: grants } }]) } } };
}
const refund = [{ section: 'finance', action: 'refund', scope: 'BUSINESS' }];
const handle = { handle: () => of(actorMay('refunds')) };

describe('Beauty action guard and interceptor cooperate without widening legacy roles', () => {
  it('defers only an explicitly annotated action and never an owner route', () => {
    const guard = new RoleGuard(new Reflector());
    expect(guard.canActivate(context())).toBe(true);
    expect(() => guard.canActivate(context('owner'))).toThrow(ForbiddenException);
  });
  it('allows an explicit custom refund inside the handler without granting owner rights', async () => {
    const f = fixture(refund);
    const result = await new AuthorInterceptor(f as never).intercept(context(), { handle: () => of({ refund: actorMay('refunds'), owner: actorMay('owner') }) });
    expect(await lastValueFrom(result)).toEqual({ refund: true, owner: false });
  });
  it('denies a revoked or missing permission and an unclassified business route', async () => {
    for (const f of [fixture([]), fixture(refund, { revoked: true })])
      await expect(new AuthorInterceptor(f as never).intercept(context(), handle)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(new AuthorInterceptor(fixture(refund) as never).intercept(context('unknown'), handle)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('still denies the legacy STAFF refund before any position assignment', async () => {
    await expect(new AuthorInterceptor(fixture([], { legacy: true }) as never).intercept(context(), handle)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('still enforces legacy access when an annotated shared route is called in another vertical', async () => {
    const f = fixture(refund, { vertical: 'HOSPITALITY' });
    await expect(new AuthorInterceptor(f as never).intercept(context(), handle)).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.db.beautyPositionAssignment.findMany).not.toHaveBeenCalled();
  });
  it('does not retain unrelated legacy manager privileges inside an assigned action', async () => {
    const result = await new AuthorInterceptor(fixture(refund) as never).intercept(context('refund','MANAGER'), { handle: () => of({ refund:actorMay('refunds'), prices:actorMay('rates'), employees:actorMay('property'), owner:actorMay('owner') }) });
    expect(await lastValueFrom(result)).toEqual({ refund:true, prices:false, employees:false, owner:false });
  });

  it('opens the bundled self portal with payroll OWN without requiring journal access',async()=>{
    const grants=[{section:'payroll',action:'view',scope:'OWN'}];
    const result=await new AuthorInterceptor(fixture(grants) as never).intercept(context('personal'),{handle:()=>of({section:currentBeautyOperation()?.section,refund:actorMay('refunds')})});
    expect(await lastValueFrom(result)).toEqual({section:'payroll',refund:false});
  });
  it('requires both inventory creation and finance creation for a retail sale',async()=>{
    const stock=[{section:'stock',action:'create',scope:'BUSINESS'}];
    await expect(new AuthorInterceptor(fixture(stock) as never).intercept(context('stockSale'),handle)).rejects.toBeInstanceOf(ForbiddenException);
    expect(await lastValueFrom(await new AuthorInterceptor(fixture([...stock,{section:'finance',action:'create',scope:'BUSINESS'}]) as never).intercept(context('stockSale'),{handle:()=>of('ok')}))).toBe('ok');
  });

});
