import { describe,it,expect,vi } from 'vitest';
import { ExpenseDocumentsController } from './expense-documents';
import type { PrismaService } from '../database/prisma.provider';
describe('expense API safe defaults',()=>{
 const payload={categoryId:'00000000-0000-0000-0000-000000000001',title:'Synthetic',documentDate:'2026-10-16',amountMinor:'100',currency:'KZT'};
 it('validates supplier receipt identifiers',async()=>{
  await expect(new ExpenseDocumentsController({} as PrismaService).create({...payload,supplierReceiptId:'invalid'},'test')).rejects.toMatchObject({status:400});
 });
 it.each(['', ' '.repeat(3), 'x'.repeat(201), '\n'])('rejects invalid idempotency key %j as 400',async key=>{
  await expect(new ExpenseDocumentsController({} as PrismaService).create(payload,key)).rejects.toMatchObject({status:400});
 });
 it('sanitizes database outages and unknown SQL errors as 503; known constraints alone are 409',async()=>{
  const controller=new ExpenseDocumentsController({} as PrismaService);
  const spy=vi.spyOn(console,'error').mockImplementation(()=>{});
  try {
   for(const error of [Object.assign(new Error('postgresql://secret SELECT private_pii'),{code:'P1001'}),{code:'P2010',meta:{code:'42703',message:'SELECT private_pii'}}]) {
    await expect(controller['execute'](async()=>{throw error;})).rejects.toMatchObject({status:503,message:'Expense service temporarily unavailable'});
   }
   await expect(controller['execute'](async()=>{throw {code:'P2010',meta:{code:'23505'}};})).rejects.toMatchObject({status:409});
   expect(JSON.stringify(spy.mock.calls)).not.toMatch(/secret|SELECT|private_pii|postgresql/);
   expect(spy).toHaveBeenCalled();
  } finally {spy.mockRestore();}
 });
 it.each(['', ' ', '\n'])('validates settlement idempotency key %j',async key=>{
  await expect(new ExpenseDocumentsController({} as PrismaService).link(payload.categoryId,{sourceType:'HOTEL_CASH',sourceOperationId:payload.categoryId},key)).rejects.toMatchObject({status:400});
 });
 it('accepts marketing binding through the same guarded expense API',async()=>{
  const controller=new ExpenseDocumentsController({} as PrismaService);
  const create=vi.fn().mockResolvedValue({id:payload.categoryId});
  vi.spyOn(controller as unknown as {store:()=>Promise<unknown>},'store').mockResolvedValue({locationId:payload.categoryId,store:{create}});
  await expect(controller.create({...payload,marketingExpenseId:payload.categoryId},'marketing-intent')).resolves.toEqual({id:payload.categoryId});
  expect(create.mock.calls[0]?.[3]).toMatchObject({marketingExpenseId:payload.categoryId});
  await expect(controller.create({...payload,marketingExpenseId:'invalid'},'marketing-intent')).rejects.toMatchObject({status:400});
 });
 it('stays disabled before held migration release',async()=>{
  const controller=new ExpenseDocumentsController({} as PrismaService);
  await expect(controller.list()).rejects.toThrow('Expense linking is not enabled');
 });
});
